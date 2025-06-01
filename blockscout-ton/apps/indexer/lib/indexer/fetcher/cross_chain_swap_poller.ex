defmodule Indexer.Fetcher.CrossChainSwapPoller do
  @moduledoc """
  Simple cross-chain swap poller for hackathon project.

  Polls /orders endpoint every 10 seconds to fetch new cross-chain orders.
  Converts decimal addresses to hex format for display.

  Simplified for demo purposes - single endpoint, no status updates.
  """

  use GenServer
  use Indexer.Fetcher, restart: :permanent

  require Logger
  import Ecto.Query, only: [from: 2]

  alias Explorer.Repo
  alias Explorer.Chain.CrossChainSwap
  alias Explorer.Chain.Events.Publisher

  @default_interval :timer.seconds(10)

  defstruct interval: @default_interval,
            enabled: true,
            api_config: %{},
            stats: %{
              total_polls: 0,
              orders_ingested: 0
            }

  def start_link(init_opts, gen_server_opts \\ []) do
    GenServer.start_link(__MODULE__, init_opts, gen_server_opts ++ [name: __MODULE__])
  end

  def child_spec([init_arguments]) do
    child_spec([init_arguments, []])
  end

  def child_spec([_init_arguments, _gen_server_options] = start_link_arguments) do
    default = %{
      id: __MODULE__,
      start: {__MODULE__, :start_link, start_link_arguments}
    }

    Supervisor.child_spec(default, [])
  end

  @impl GenServer
  def init(opts) when is_list(opts) do
    interval = System.get_env("CROSS_CHAIN_POLL_INTERVAL", "10000") |> String.to_integer()
    enabled = System.get_env("CROSS_CHAIN_POLLER_ENABLED", "true") |> String.downcase() == "true"

    state = %__MODULE__{
      interval: interval,
      enabled: enabled,
      api_config: build_api_config()
    }

    if enabled do
      Logger.info(
        "CrossChainSwapPoller started - polling #{state.api_config.base_url}/orders every #{interval}ms"
      )

      schedule_next_poll(0)
    else
      Logger.info("CrossChainSwapPoller disabled")
    end

    {:ok, state}
  end

  @impl GenServer
  def handle_info(:poll_orders, %{enabled: false} = state), do: {:noreply, state}

  def handle_info(:poll_orders, %{enabled: true} = state) do
    Logger.info("Polling cross-chain orders")

    updated_state =
      state
      |> update_stats(:total_polls, &(&1 + 1))
      |> poll_orders()

    schedule_next_poll(updated_state.interval)
    {:noreply, updated_state}
  end

  def handle_info(message, state) do
    Logger.debug("Unexpected message: #{inspect(message)}")
    {:noreply, state}
  end

  @impl GenServer
  def handle_call(:get_stats, _from, state) do
    stats = Map.merge(state.stats, %{enabled: state.enabled, interval: state.interval})
    {:reply, stats, state}
  end

  def handle_call(:toggle_enabled, _from, state) do
    new_enabled = not state.enabled
    new_state = %{state | enabled: new_enabled}

    if new_enabled do
      schedule_next_poll(0)
    else
      Logger.info("CrossChainSwapPoller disabled")
    end

    {:reply, new_enabled, new_state}
  end

  # Public API
  def get_stats, do: GenServer.call(__MODULE__, :get_stats)
  def toggle_enabled, do: GenServer.call(__MODULE__, :toggle_enabled)

  # Private functions
  defp schedule_next_poll(interval), do: Process.send_after(self(), :poll_orders, interval)

  defp poll_orders(state) do
    try do
      new_count = ingest_new_orders(state.api_config)
      Logger.info("Poll complete: #{new_count} new orders")

      state
      |> update_stats(:orders_ingested, &(&1 + new_count))
    rescue
      error ->
        Logger.error("Poll failed: #{inspect(error)}")
        state
    end
  end

  defp ingest_new_orders(api_config) do
    case fetch_orders(api_config) do
      {:ok, orders} when length(orders) > 0 ->
        existing_swaps = get_existing_swaps(Enum.map(orders, & &1.order_id))
        existing_order_ids = MapSet.new(existing_swaps, & &1.metadata["order_id"])

        # Separate new orders from status updates
        {new_orders, status_updates} =
          Enum.split_with(orders, &(!MapSet.member?(existing_order_ids, &1.order_id)))

        new_count = if length(new_orders) > 0, do: insert_orders(new_orders), else: 0

        updated_count =
          if length(status_updates) > 0,
            do: update_order_statuses(status_updates, existing_swaps),
            else: 0

        Logger.info("Processed #{new_count} new orders, #{updated_count} status updates")
        new_count + updated_count

      {:ok, []} ->
        Logger.info("No orders found")
        0

      {:error, reason} ->
        Logger.error(
          "Failed to fetch orders from #{api_config.base_url}/orders: #{inspect(reason)}"
        )

        0
    end
  end

  defp fetch_orders(api_config) do
    url = "#{api_config.base_url}/orders"
    headers = [{"Content-Type", "application/json"}]

    Logger.info("Fetching orders from: #{url}")

    case HTTPoison.get(url, headers, timeout: 10000) do
      {:ok, %{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, orders} when is_list(orders) ->
            parsed_orders = Enum.map(orders, &parse_order/1)
            Logger.info("Successfully parsed #{length(parsed_orders)} orders")
            {:ok, parsed_orders}

          {:ok, _} ->
            Logger.error("Expected array of orders, got: #{body}")
            {:error, :invalid_response_format}

          {:error, _} = error ->
            Logger.error("Failed to decode JSON: #{body}")
            error
        end

      {:ok, %{status_code: status_code, body: body}} ->
        Logger.error("HTTP #{status_code}: #{body}")
        {:error, {:http_error, status_code}}

      {:error, %{reason: reason}} ->
        Logger.error("HTTP request failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp parse_order(order_data) do
    # Convert decimal to_address to hex ETH address
    eth_address =
      case Integer.parse(order_data["to_address"]) do
        {decimal_addr, ""} ->
          ("0x" <> Integer.to_string(decimal_addr, 16))
          |> String.downcase()
          |> String.pad_leading(40, "0")

        _ ->
          # fallback if not a valid integer
          order_data["to_address"]
      end

    # Extract escrow information from actual API fields
    src_escrow = order_data["escrow_contract_address"]
    dst_escrow = order_data["resolver_addr"]

    %{
      order_id: to_string(order_data["order_id"] || order_data["orderId"]),
      transaction_hash: order_data["hash_key"],
      source_chain_name: "TON",
      destination_chain_name: "Ethereum",
      # Read status from API response, default to "created" if not provided
      status: normalize_status(order_data["status"] || "created"),
      amount: parse_amount(order_data["from_amount"]),
      token_symbol: "TON",
      # ETH address as main user_address
      user_address: eth_address,
      settlement_tx_hash: nil,
      to_address: eth_address,
      to_amount: parse_amount(order_data["to_amount"]),
      to_network: order_data["to_network"],
      timestamp: parse_timestamp(order_data["timestamp"]),
      metadata: %{
        "order_id" => order_data["order_id"],
        "to_network" => order_data["to_network"],
        "to_address_decimal" => order_data["to_address"],
        "to_address_hex" => eth_address,
        # TON address in metadata
        "from_address" => order_data["from_address"] || order_data["userAddress"],
        # New amount fields
        "from_amount" => order_data["from_amount"],
        "to_amount" => order_data["to_amount"],
        # Escrow information from API response
        "src_escrow" => src_escrow,
        "dst_escrow" => dst_escrow,
        # Additional fields from API
        "escrow_contract_address" => order_data["escrow_contract_address"],
        "resolver_addr" => order_data["resolver_addr"],
        "to_token" => order_data["to_token"]
      }
    }
  end

  defp parse_amount(amount_str) when is_binary(amount_str) do
    case Decimal.new(amount_str) do
      %Decimal{} = decimal -> decimal
      _ -> Decimal.new("0")
    end
  end

  defp parse_amount(amount) when is_number(amount), do: Decimal.new(amount)
  defp parse_amount(_), do: Decimal.new("0")

  defp parse_timestamp(timestamp_str) when is_binary(timestamp_str) do
    # Pad timestamp to microsecond precision if needed
    padded_timestamp = pad_to_microseconds(timestamp_str)

    case DateTime.from_iso8601(padded_timestamp) do
      {:ok, datetime, _} -> datetime
      _ -> DateTime.utc_now()
    end
  end

  defp parse_timestamp(_), do: DateTime.utc_now()

  # Helper function to normalize status values
  defp normalize_status(status) when is_binary(status) do
    case String.downcase(status) do
      "created" -> "created"
      "pending" -> "pending"
      "completed" -> "completed"
      # Default fallback to created
      _ -> "created"
    end
  end

  defp normalize_status(_), do: "created"

  # Helper function to pad timestamp to microsecond precision
  defp pad_to_microseconds(timestamp_str) do
    # Handle timestamps like "2025-05-31T21:44:01.621Z" -> "2025-05-31T21:44:01.621000Z"
    case String.split(timestamp_str, ".") do
      [date_part, time_part] ->
        # Extract seconds and timezone parts
        case String.split(time_part, "Z") do
          [seconds_part, ""] ->
            # Pad seconds to 6 decimal places
            padded_seconds = String.pad_trailing(seconds_part, 6, "0")
            "#{date_part}.#{padded_seconds}Z"

          _ ->
            # Return original if format doesn't match
            timestamp_str
        end

      _ ->
        # Return original if no decimal point found
        timestamp_str
    end
  end

  defp get_existing_swaps(order_ids) do
    from(s in CrossChainSwap,
      where: fragment("?->>'order_id'", s.metadata) in ^order_ids,
      select: s
    )
    |> Repo.all()
  end

  defp insert_orders(orders) do
    formatted_orders =
      Enum.map(orders, fn order ->
        %{
          id: Ecto.UUID.generate(),
          source_chain_name: order.source_chain_name,
          destination_chain_name: order.destination_chain_name,
          transaction_hash: order.transaction_hash,
          status: order.status,
          amount: order.amount,
          token_symbol: order.token_symbol,
          user_address: order.user_address,
          settlement_tx_hash: order.settlement_tx_hash,
          metadata: order.metadata,
          retry_count: 0,
          inserted_at: order.timestamp,
          updated_at: DateTime.utc_now()
        }
      end)

    {count, inserted_orders} = Repo.insert_all(CrossChainSwap, formatted_orders, returning: true)
    Logger.info("Inserted #{count} new orders")

    # Broadcast new orders via WebSocket
    if count > 0 do
      Logger.info("Broadcasting new orders via WebSocket")
      Publisher.broadcast([{:cross_chain_swaps, inserted_orders}], :realtime)
    end

    count
  end

  defp update_order_statuses(status_updates, existing_swaps) do
    # Create a map of order_id -> existing swap for quick lookup
    existing_swaps_map =
      Enum.into(existing_swaps, %{}, fn swap -> {swap.metadata["order_id"], swap} end)

    # Find swaps that actually need updates (status or metadata changes)
    swaps_to_update =
      Enum.filter(status_updates, fn update ->
        existing_swap = existing_swaps_map[update.order_id]

        if existing_swap do
          # Check if status changed
          status_changed = existing_swap.status != update.status

          # Check if escrow metadata changed
          existing_src_escrow = existing_swap.metadata["src_escrow"]
          existing_dst_escrow = existing_swap.metadata["dst_escrow"]
          new_src_escrow = update.metadata["src_escrow"]
          new_dst_escrow = update.metadata["dst_escrow"]

          metadata_changed =
            existing_src_escrow != new_src_escrow || existing_dst_escrow != new_dst_escrow

          # Update if either status or metadata changed
          status_changed || metadata_changed
        else
          false
        end
      end)

    if length(swaps_to_update) > 0 do
      updated_swaps =
        Enum.map(swaps_to_update, fn update ->
          existing_swap = existing_swaps_map[update.order_id]

          # Update the swap in database with both status and metadata
          {:ok, updated_swap} =
            existing_swap
            |> Ecto.Changeset.change(%{
              status: update.status,
              metadata: update.metadata,
              updated_at: DateTime.utc_now()
            })
            |> Repo.update()

          updated_swap
        end)

      Logger.info("Updated #{length(updated_swaps)} swaps (status and/or metadata)")

      # Broadcast status updates via WebSocket
      if length(updated_swaps) > 0 do
        Logger.info("Broadcasting swap updates via WebSocket")
        Publisher.broadcast([{:cross_chain_swaps, updated_swaps}], :realtime)
      end

      length(updated_swaps)
    else
      0
    end
  end

  defp update_stats(state, key, update_fn) do
    new_stats = Map.update!(state.stats, key, update_fn)
    %{state | stats: new_stats}
  end

  defp build_api_config do
    %{
      base_url:
        System.get_env(
          "CROSS_CHAIN_API_BASE_URL",
          "https://ethprague-backend-cyrpf.ondigitalocean.app"
        ),
      timeout: 10000
    }
  end
end
