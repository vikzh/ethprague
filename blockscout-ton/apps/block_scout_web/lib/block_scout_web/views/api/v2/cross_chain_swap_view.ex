defmodule BlockScoutWeb.API.V2.CrossChainSwapView do
  use BlockScoutWeb, :view

  alias Explorer.Chain.Hash

  def render("cross_chain_swaps.json", %{
        cross_chain_swaps: swaps,
        next_page_params: next_page_params
      }) do
    %{
      "items" => Enum.map(swaps, &render("cross_chain_swap.json", %{cross_chain_swap: &1})),
      "next_page_params" => next_page_params
    }
  end

  def render("cross_chain_swap.json", %{cross_chain_swap: swap}) do
    %{
      "id" => swap.id,
      "source_chain" => swap.source_chain_name,
      "destination_chain" => swap.destination_chain_name,
      "transaction_hash" => to_string(swap.transaction_hash),
      "status" => swap.status,
      "amount" => format_amount(swap.amount),
      "token_symbol" => swap.token_symbol,
      "user_address" => format_address(swap.user_address),
      "settlement_tx_hash" => format_address(swap.settlement_tx_hash),
      "metadata" => swap.metadata || %{},
      "error_message" => swap.error_message,
      "retry_count" => swap.retry_count,
      "created_at" => format_datetime(swap.inserted_at),
      "updated_at" => format_datetime(swap.updated_at)
    }
  end

  def render("stats.json", %{stats: stats}) do
    %{
      "total_swaps" => stats.total_swaps,
      "pending_swaps" => stats.pending_swaps,
      "settled_swaps" => stats.settled_swaps,
      "failed_swaps" => stats.failed_swaps,
      "success_rate" => calculate_success_rate(stats)
    }
  end

  def render("status_poll.json", %{updated_swaps: swaps, poll_timestamp: timestamp}) do
    %{
      "updated_swaps" =>
        Enum.map(swaps, &render("cross_chain_swap.json", %{cross_chain_swap: &1})),
      "poll_timestamp" => timestamp,
      "updates_count" => length(swaps)
    }
  end

  def render("message.json", %{message: message}) do
    %{
      "message" => message
    }
  end

  # Private helper functions

  defp format_amount(nil), do: nil
  defp format_amount(amount), do: to_string(amount)

  defp format_address(nil), do: nil
  defp format_address(%Hash{} = hash), do: to_string(hash)
  defp format_address(hash) when is_binary(hash), do: hash

  defp format_datetime(nil), do: nil
  defp format_datetime(datetime), do: DateTime.to_iso8601(datetime)

  defp calculate_success_rate(%{total_swaps: 0}), do: "0"

  defp calculate_success_rate(%{total_swaps: total, settled_swaps: settled}) do
    rate = (settled / total * 100) |> :erlang.float_to_binary(decimals: 2)
    "#{rate}%"
  end
end
