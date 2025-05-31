defmodule Indexer.Fetcher.CrossChainSwapPoller do
  @moduledoc """
  Simple cross-chain swap poller for hackathon project.

  Polls external bridge API every 10 seconds to:
  1. Fetch new swaps
  2. Update pending swap statuses

  Simplified for demo purposes - no complex error handling or batching.
  """

  use GenServer
  use Indexer.Fetcher, restart: :permanent

  require Logger
  import Ecto.Query, only: [from: 2]

  alias Explorer.Repo
  alias Explorer.Chain.CrossChainSwap

  @default_interval :timer.seconds(10)
  @max_retries 3

  defstruct interval: @default_interval,
            enabled: true,
            api_config: %{},
            stats: %{
              total_polls: 0,
              swaps_updated: 0,
              swaps_ingested: 0
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
      Logger.info("CrossChainSwapPoller started (simplified) - #{interval}ms interval")
      schedule_next_poll(0)
    else
      Logger.info("CrossChainSwapPoller disabled")
    end

    {:ok, state}
  end

  @impl GenServer
  def handle_info(:poll_swaps, %{enabled: false} = state), do: {:noreply, state}

  def handle_info(:poll_swaps, %{enabled: true} = state) do
    Logger.info("Starting cross-chain swap poll")

    updated_state =
      state
      |> update_stats(:total_polls, &(&1 + 1))
      |> poll_swaps()

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

    if new_enabled, do: schedule_next_poll(0)
    Logger.info("CrossChainSwapPoller #{if new_enabled, do: "enabled", else: "disabled"}")

    {:reply, new_enabled, new_state}
  end

  # Public API
  def get_stats, do: GenServer.call(__MODULE__, :get_stats)
  def toggle_enabled, do: GenServer.call(__MODULE__, :toggle_enabled)

  # Private functions
  defp schedule_next_poll(interval), do: Process.send_after(self(), :poll_swaps, interval)

  defp poll_swaps(state) do
    try do
      # 1. Ingest new swaps
      new_count = ingest_new_swaps(state.api_config)

      # 2. Update pending swaps
      updated_count = update_pending_swaps(state.api_config)

      Logger.info("Poll complete: #{new_count} new, #{updated_count} updated")

      state
      |> update_stats(:swaps_ingested, &(&1 + new_count))
      |> update_stats(:swaps_updated, &(&1 + updated_count))
    rescue
      error ->
        Logger.error("Poll failed: #{inspect(error)}")
        state
    end
  end

  defp ingest_new_swaps(api_config) do
    case fetch_new_swaps(api_config) do
      {:ok, swaps} when length(swaps) > 0 ->
        existing_hashes = get_existing_hashes(Enum.map(swaps, & &1.transaction_hash))
        new_swaps = Enum.reject(swaps, &MapSet.member?(existing_hashes, &1.transaction_hash))

        if length(new_swaps) > 0 do
          insert_swaps(new_swaps)
        else
          0
        end

      _ ->
        0
    end
  end

  defp update_pending_swaps(api_config) do
    pending_swaps = get_pending_swaps()

    pending_swaps
    |> Enum.map(&update_swap_status(&1, api_config))
    |> Enum.count(& &1)
  end

  defp fetch_new_swaps(api_config) do
    url = "#{api_config.base_url}/api/v1/swaps/recent"
    headers = [{"Content-Type", "application/json"}]

    case HTTPoison.get(url, headers, timeout: 5000) do
      {:ok, %{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"success" => true, "data" => %{"swaps" => swaps}}} ->
            parsed_swaps = Enum.map(swaps, &parse_swap/1)
            {:ok, parsed_swaps}

          _ ->
            {:error, :invalid_response}
        end

      _ ->
        {:error, :request_failed}
    end
  end

  defp parse_swap(swap_data) do
    %{
      transaction_hash: swap_data["transaction_hash"],
      source_chain_name: swap_data["source_chain"],
      destination_chain_name: swap_data["destination_chain"],
      status: swap_data["status"],
      amount: Decimal.new(swap_data["amount"]),
      token_symbol: swap_data["token_symbol"],
      user_address: swap_data["user_address"],
      metadata: swap_data["metadata"] || %{}
    }
  end

  defp get_existing_hashes(tx_hashes) do
    from(s in CrossChainSwap,
      where: s.transaction_hash in ^tx_hashes,
      select: s.transaction_hash
    )
    |> Repo.all()
    |> MapSet.new()
  end

  defp insert_swaps(swaps) do
    formatted_swaps =
      Enum.map(swaps, fn swap ->
        %{
          id: Ecto.UUID.generate(),
          source_chain_name: swap.source_chain_name,
          destination_chain_name: swap.destination_chain_name,
          transaction_hash: swap.transaction_hash,
          status: swap.status,
          amount: swap.amount,
          token_symbol: swap.token_symbol,
          user_address: swap.user_address,
          metadata: swap.metadata,
          retry_count: 0,
          inserted_at: DateTime.utc_now(),
          updated_at: DateTime.utc_now()
        }
      end)

    {count, _} = Repo.insert_all(CrossChainSwap, formatted_swaps)
    Logger.info("Inserted #{count} new swaps")
    count
  end

  defp get_pending_swaps do
    from(s in CrossChainSwap,
      where: s.status == "pending" and s.retry_count < ^@max_retries,
      order_by: [asc: s.inserted_at],
      limit: 20
    )
    |> Repo.all()
  end

  defp update_swap_status(swap, api_config) do
    url = "#{api_config.base_url}/api/v1/swaps/#{swap.transaction_hash}/status"
    headers = [{"Content-Type", "application/json"}]

    case HTTPoison.get(url, headers, timeout: 3000) do
      {:ok, %{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"success" => true, "data" => data}} ->
            apply_status_update(swap, data)

          _ ->
            false
        end

      {:ok, %{status_code: 404}} ->
        false

      _ ->
        increment_retry_count(swap)
        false
    end
  end

  defp apply_status_update(swap, update_data) do
    new_status = update_data["status"]

    if new_status != swap.status do
      attrs = %{
        status: new_status,
        metadata:
          Map.put(swap.metadata, "last_checked_at", DateTime.to_iso8601(DateTime.utc_now()))
      }

      attrs =
        if update_data["settlement_tx_hash"] do
          Map.put(attrs, :settlement_tx_hash, update_data["settlement_tx_hash"])
        else
          attrs
        end

      attrs =
        if new_status == "failed" do
          Map.merge(attrs, %{
            retry_count: swap.retry_count + 1,
            error_message: update_data["error_message"] || "External API reported failure"
          })
        else
          attrs
        end

      case Repo.update(CrossChainSwap.changeset(swap, attrs)) do
        {:ok, _} ->
          Logger.info("Updated swap #{swap.transaction_hash}: #{swap.status} → #{new_status}")
          true

        {:error, _} ->
          false
      end
    else
      touch_swap(swap)
      false
    end
  end

  defp touch_swap(swap) do
    attrs = %{
      metadata: Map.put(swap.metadata, "last_checked_at", DateTime.to_iso8601(DateTime.utc_now()))
    }

    Repo.update(CrossChainSwap.changeset(swap, attrs))
  end

  defp increment_retry_count(swap) do
    Repo.update(CrossChainSwap.changeset(swap, %{retry_count: swap.retry_count + 1}))
  end

  defp update_stats(state, key, update_fn) do
    new_stats = Map.update!(state.stats, key, update_fn)
    %{state | stats: new_stats}
  end

  defp build_api_config do
    %{
      base_url: System.get_env("CROSS_CHAIN_API_BASE_URL", "http://localhost:3001"),
      timeout: 5000
    }
  end
end
