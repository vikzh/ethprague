defmodule BlockScoutWeb.API.V2.CrossChainSwapController do
  use BlockScoutWeb, :controller

  import BlockScoutWeb.Chain,
    only: [
      next_page_params: 3,
      split_list_by_page: 1
    ]

  import BlockScoutWeb.PagingHelper, only: [paging_options: 2]
  import Ecto.Query, only: [from: 2, limit: 2]

  alias Explorer.{Chain, Repo}
  alias Explorer.Chain.CrossChainSwap

  action_fallback(BlockScoutWeb.API.V2.FallbackController)

  @api_true [api?: true]

  @doc """
  Function to handle GET requests to `/api/v2/cross-chain-swaps` endpoint.
  """
  @spec cross_chain_swaps(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def cross_chain_swaps(conn, params) do
    full_options =
      [
        necessity_by_association: %{}
      ]
      |> Keyword.merge(paging_options(params, [:inserted_at, :id]))
      |> Keyword.merge(@api_true)

    swaps_plus_one =
      CrossChainSwap.list_swaps_query()
      |> apply_filters(params)
      |> Chain.select_repo(full_options).all()

    {swaps, next_page} = split_list_by_page(swaps_plus_one)

    next_page_params =
      next_page
      |> next_page_params(swaps, [:inserted_at, :id])
      |> delete_parameters_from_next_page_params()

    conn
    |> put_status(200)
    |> render(:cross_chain_swaps, %{
      cross_chain_swaps: swaps,
      next_page_params: next_page_params
    })
  end

  @doc """
  Function to handle GET requests to `/api/v2/cross-chain-swaps/:id` endpoint.
  """
  @spec cross_chain_swap(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def cross_chain_swap(conn, %{"id" => id}) do
    with {:ok, _uuid} <- Ecto.UUID.cast(id),
         %CrossChainSwap{} = swap <- Repo.get(CrossChainSwap, id) do
      conn
      |> put_status(200)
      |> render(:cross_chain_swap, %{cross_chain_swap: swap})
    else
      :error ->
        conn
        |> put_status(422)
        |> render(:message, %{message: "Invalid UUID format"})

      nil ->
        conn
        |> put_status(404)
        |> render(:message, %{message: "Cross-chain swap not found"})
    end
  end

  @doc """
  Function to handle GET requests to `/api/v2/cross-chain-swaps/stats` endpoint.
  """
  @spec stats(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def stats(conn, _params) do
    total_count = Repo.aggregate(CrossChainSwap, :count, :id)
    status_counts = CrossChainSwap.count_by_status()

    stats = %{
      total_swaps: total_count,
      pending_swaps: Map.get(status_counts, "pending", 0),
      settled_swaps: Map.get(status_counts, "settled", 0),
      failed_swaps: Map.get(status_counts, "failed", 0)
    }

    conn
    |> put_status(200)
    |> render(:stats, %{stats: stats})
  end

  @doc """
  Function to handle GET requests to `/api/v2/cross-chain-swaps/status-poll` endpoint.
  Returns recent swaps from database (Phase 2 implementation).
  """
  @spec status_poll(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def status_poll(conn, params) do
    # For Phase 2: just return recent swaps from database
    # In real implementation this would query external settlement APIs for updates

    last_poll_time = parse_poll_timestamp(params["since"])

    # Return swaps updated since the last poll time, or recent swaps if no timestamp
    recent_swaps =
      CrossChainSwap.list_swaps_query()
      |> apply_time_filter(last_poll_time)
      |> limit(10)
      |> Repo.all()

    conn
    |> put_status(200)
    |> render(:status_poll, %{
      updated_swaps: recent_swaps,
      poll_timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  # Private helper functions

  defp apply_filters(query, params) do
    query
    |> filter_by_status(params["status"])
    |> filter_by_chain(params["chain"])
    |> filter_by_token(params["token"])
  end

  defp filter_by_status(query, nil), do: query

  defp filter_by_status(query, status) when status in ["pending", "settled", "failed"] do
    CrossChainSwap.filter_by_status_query(query, status)
  end

  defp filter_by_status(query, _), do: query

  defp filter_by_chain(query, nil), do: query

  defp filter_by_chain(query, chain) when is_binary(chain) do
    CrossChainSwap.filter_by_chain_query(query, chain)
  end

  defp filter_by_chain(query, _), do: query

  defp filter_by_token(query, nil), do: query

  defp filter_by_token(query, token) when is_binary(token) do
    from(s in query, where: s.token_symbol == ^String.upcase(token))
  end

  defp filter_by_token(query, _), do: query

  defp apply_time_filter(query, nil), do: query

  defp apply_time_filter(query, since_time) do
    from(s in query, where: s.updated_at > ^since_time)
  end

  defp parse_poll_timestamp(nil), do: nil

  defp parse_poll_timestamp(timestamp_string) do
    case DateTime.from_iso8601(timestamp_string) do
      {:ok, datetime, _} -> datetime
      _ -> nil
    end
  end

  defp delete_parameters_from_next_page_params(params) do
    params
    |> Map.delete("type")
    |> Map.delete("method")
    |> Map.delete("filter")
  end
end
