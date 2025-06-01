defmodule BlockScoutWeb.CrossChainSwapView do
  use BlockScoutWeb, :view

  use Gettext, backend: BlockScoutWeb.Gettext

  @doc """
  Returns CSS class for status badge based on swap status
  """
  def status_badge_class(status) do
    case status do
      "created" -> "badge-secondary"
      "pending" -> "badge-warning"
      "completed" -> "badge-success"
      _ -> "badge-secondary"
    end
  end

  @doc """
  Returns human-readable status text
  """
  def status_text(status) do
    case status do
      "created" -> gettext("Created")
      "pending" -> gettext("Pending")
      "completed" -> gettext("Completed")
      _ -> String.capitalize(status)
    end
  end

  @doc """
  Formats the chain direction display (Source → Destination)
  """
  def chain_direction(swap) do
    "#{swap.source_chain_name} → #{swap.destination_chain_name}"
  end

  @doc """
  Formats the amount with token symbol
  """
  def format_amount_with_token(nil, _), do: "—"
  def format_amount_with_token(amount, nil), do: to_string(amount)

  def format_amount_with_token(amount, token_symbol) do
    formatted_amount = amount |> Decimal.to_string() |> format_number()
    "#{formatted_amount} #{token_symbol}"
  end

  # Simple number formatting helper
  defp format_number(number_string) do
    # Add thousand separators for better readability
    case String.split(number_string, ".") do
      [whole] -> add_thousand_separators(whole)
      [whole, decimal] -> "#{add_thousand_separators(whole)}.#{decimal}"
    end
  end

  defp add_thousand_separators(str) do
    str
    |> String.reverse()
    |> String.graphemes()
    |> Enum.chunk_every(3)
    |> Enum.map(&Enum.join/1)
    |> Enum.join(",")
    |> String.reverse()
  end

  @doc """
  Formats a hash for display (shortened with ellipsis)
  """
  def format_hash(nil), do: "—"

  def format_hash(hash) when is_binary(hash) do
    if String.length(hash) > 20 do
      "#{String.slice(hash, 0, 10)}...#{String.slice(hash, -8, 8)}"
    else
      hash
    end
  end

  def format_hash(hash), do: hash |> to_string() |> format_hash()

  @doc """
  Returns the full hash for copying
  """
  def full_hash(nil), do: ""
  def full_hash(hash), do: to_string(hash)

  @doc """
  Formats datetime for display
  """
  def format_datetime(nil), do: "—"

  def format_datetime(datetime) do
    datetime
    |> Timex.to_datetime()
    |> Timex.format!("{YYYY}-{0M}-{0D} {h24}:{m}:{s}")
  end

  @doc """
  Returns relative time (e.g., "2 hours ago")
  """
  def relative_time(nil), do: "—"

  def relative_time(datetime) do
    datetime
    |> Timex.to_datetime()
    |> Timex.from_now()
  end

  @doc """
  Returns CSS class for chain icon
  """
  def chain_icon_class(chain_name) do
    case chain_name do
      "TON" -> "chain-icon-ton"
      "Ethereum" -> "chain-icon-eth"
      "Polygon" -> "chain-icon-polygon"
      "BSC" -> "chain-icon-bsc"
      "Arbitrum" -> "chain-icon-arbitrum"
      "Optimism" -> "chain-icon-optimism"
      _ -> "chain-icon-default"
    end
  end

  @doc """
  Returns whether the swap has error details
  """
  def has_error?(swap), do: not is_nil(swap.error_message)

  @doc """
  Returns whether the swap is completed
  """
  def completed?(swap), do: swap.status == "completed"

  @doc """
  Returns whether the swap has settlement transaction
  """
  def has_settlement_tx?(swap), do: not is_nil(swap.settlement_tx_hash)

  @doc """
  Formats retry count display
  """
  def retry_count_text(0), do: gettext("No retries")
  def retry_count_text(1), do: gettext("1 retry")
  def retry_count_text(count), do: gettext("%{count} retries", count: count)

  @doc """
  Returns the page title for swap details
  """
  def page_title(swap) do
    gettext("Cross-Chain Swap %{id}", id: String.slice(swap.id, 0, 8))
  end

  @doc """
  Returns success rate as percentage
  """
  def success_rate(stats) do
    if stats.total_swaps > 0 do
      completed_swaps = stats[:completed_swaps] || 0
      rate = (completed_swaps / stats.total_swaps * 100) |> Float.round(1)
      "#{rate}%"
    else
      "0%"
    end
  end

  @doc """
  Returns filter options for the dropdown
  """
  def filter_options do
    [
      {"All", "all"},
      {"Created", "created"},
      {"Pending", "pending"},
      {"Completed", "completed"}
    ]
  end

  @doc """
  Formats an address for display (shortened with ellipsis)
  """
  def format_address(nil), do: "—"

  def format_address(address) when is_binary(address) do
    if String.length(address) > 14 do
      "#{String.slice(address, 0, 8)}…#{String.slice(address, -6, 6)}"
    else
      address
    end
  end

  def format_address(_), do: "—"

  @doc """
  Gets the from_address (TON address) from metadata
  """
  def get_from_address(swap) do
    case swap.metadata do
      %{"from_address" => from_address} when is_binary(from_address) -> from_address
      _ -> "—"
    end
  end

  @doc """
  Gets the to_address (ETH address) which is stored in user_address field
  """
  def get_to_address(swap) do
    swap.user_address || "—"
  end

  @doc """
  Gets the from_amount from metadata and formats it with TON
  """
  def get_from_amount(swap) do
    case swap.metadata do
      %{"from_amount" => from_amount} when is_binary(from_amount) ->
        case Decimal.new(from_amount) do
          %Decimal{} = decimal ->
            formatted_amount = decimal |> Decimal.to_string() |> format_number()
            "#{formatted_amount} TON"

          _ ->
            "— TON"
        end

      _ ->
        "— TON"
    end
  end

  @doc """
  Gets the to_amount from metadata and formats it with TUSDC
  """
  def get_to_amount(swap) do
    case swap.metadata do
      %{"to_amount" => to_amount} when is_binary(to_amount) ->
        case Decimal.new(to_amount) do
          %Decimal{} = decimal ->
            formatted_amount = decimal |> Decimal.to_string() |> format_number()
            "#{formatted_amount} TUSDC"

          _ ->
            "— TUSDC"
        end

      _ ->
        "— TUSDC"
    end
  end

  @doc """
  Gets the src_escrow (TON transaction ID) from metadata
  """
  def get_src_escrow(swap) do
    case swap.metadata do
      %{"src_escrow" => src_escrow} when is_binary(src_escrow) and src_escrow != "" -> src_escrow
      _ -> "—"
    end
  end

  @doc """
  Gets the dst_escrow (ETH transaction ID) from metadata
  """
  def get_dst_escrow(swap) do
    case swap.metadata do
      %{"dst_escrow" => dst_escrow} when is_binary(dst_escrow) and dst_escrow != "" -> dst_escrow
      _ -> "—"
    end
  end

  @doc """
  Formats escrow transaction ID for display (shortened with ellipsis)
  """
  def format_escrow_tx(nil), do: "—"
  def format_escrow_tx(""), do: "—"
  def format_escrow_tx("—"), do: "—"

  def format_escrow_tx(tx_id) when is_binary(tx_id) do
    if String.length(tx_id) > 20 do
      "#{String.slice(tx_id, 0, 10)}...#{String.slice(tx_id, -8, 8)}"
    else
      tx_id
    end
  end

  def format_escrow_tx(tx_id), do: tx_id |> to_string() |> format_escrow_tx()

  @doc """
  Generates URL for src escrow (TON) transaction using SRC_ESCROW_URL environment variable
  """
  def src_escrow_url(tx_id) when is_binary(tx_id) and tx_id != "" and tx_id != "—" do
    base_url = System.get_env("SRC_ESCROW_URL")

    if base_url do
      "#{base_url}#{tx_id}"
    else
      nil
    end
  end

  def src_escrow_url(_), do: nil

  @doc """
  Generates URL for dst escrow (ETH) transaction using DST_ESCROW_URL environment variable
  """
  def dst_escrow_url(tx_id) when is_binary(tx_id) and tx_id != "" and tx_id != "—" do
    base_url = System.get_env("DST_ESCROW_URL")

    if base_url do
      "#{base_url}#{tx_id}"
    else
      nil
    end
  end

  def dst_escrow_url(_), do: nil

  @doc """
  Checks if src escrow has a valid URL
  """
  def has_src_escrow_url?(swap) do
    src_escrow = get_src_escrow(swap)
    !is_nil(src_escrow_url(src_escrow))
  end

  @doc """
  Checks if dst escrow has a valid URL
  """
  def has_dst_escrow_url?(swap) do
    dst_escrow = get_dst_escrow(swap)
    !is_nil(dst_escrow_url(dst_escrow))
  end
end
