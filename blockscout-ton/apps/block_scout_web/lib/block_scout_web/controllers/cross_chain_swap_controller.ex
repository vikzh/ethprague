defmodule BlockScoutWeb.CrossChainSwapController do
  use BlockScoutWeb, :controller

  import BlockScoutWeb.Account.AuthController, only: [current_user: 1]

  import BlockScoutWeb.Chain,
    only: [
      fetch_page_number: 1,
      paging_options: 1,
      next_page_params: 3,
      update_page_parameters: 3,
      split_list_by_page: 1
    ]

  import Ecto.Query, only: [from: 2]

  alias BlockScoutWeb.{AccessHelper, Controller, CrossChainSwapView}
  alias Explorer.{Chain, Repo}
  alias Explorer.Chain.CrossChainSwap
  alias Phoenix.View

  @default_options [
    necessity_by_association: %{}
  ]

  def index(conn, %{"type" => "JSON"} = params) do
    # Handle AJAX requests for real-time updates
    options =
      @default_options
      |> Keyword.merge(paging_options(params))

    full_options =
      options
      |> Keyword.put(
        :paging_options,
        params
        |> fetch_page_number()
        |> update_page_parameters(
          Chain.default_page_size(),
          Keyword.get(options, :paging_options)
        )
      )

    query =
      CrossChainSwap.list_swaps_query()
      |> apply_filters(params)

    swaps_plus_one = query |> Chain.select_repo(full_options).all()
    {swaps, next_page} = split_list_by_page(swaps_plus_one)

    next_page_params =
      next_page
      |> next_page_params(swaps, params)
      |> case do
        nil ->
          nil

        next_page_params ->
          next_page_params
          |> Map.delete("type")
          |> Map.delete("items_count")
      end

    json(
      conn,
      %{
        items:
          Enum.map(swaps, fn swap ->
            View.render_to_string(
              CrossChainSwapView,
              "_swap_tile.html",
              swap: swap,
              conn: conn
            )
          end),
        next_page_params: next_page_params
      }
    )
  end

  def index(conn, params) do
    # Main HTML page
    current_filter = Map.get(params, "filter", "all")

    # Get stats for the header
    stats = get_swap_stats()

    render(
      conn,
      "index.html",
      current_path: Controller.current_full_path(conn),
      current_user: current_user(conn),
      current_filter: current_filter,
      stats: stats
    )
  end

  def show(conn, %{"id" => id} = params) do
    with {:ok, _uuid} <- Ecto.UUID.cast(id),
         %CrossChainSwap{} = swap <- Repo.get(CrossChainSwap, id),
         {:ok, false} <- AccessHelper.restricted_access?(to_string(swap.user_address), params) do
      render(
        conn,
        "show.html",
        current_path: Controller.current_full_path(conn),
        current_user: current_user(conn),
        swap: swap
      )
    else
      :error ->
        set_not_found_view(conn, id, "Invalid swap ID format")

      nil ->
        set_not_found_view(conn, id, "Cross-chain swap not found")

      {:restricted_access, _} ->
        set_not_found_view(conn, id, "Access restricted")
    end
  end

  # Private helper functions

  defp apply_filters(query, params) do
    query
    |> filter_by_status(params["status"])
    |> filter_by_chain(params["chain"])
    |> filter_by_token(params["token"])
    |> filter_by_search(params["search"])
  end

  defp filter_by_status(query, nil), do: query
  defp filter_by_status(query, "all"), do: query

  defp filter_by_status(query, status) when status in ["pending", "settled", "failed"] do
    CrossChainSwap.filter_by_status_query(query, status)
  end

  defp filter_by_status(query, _), do: query

  defp filter_by_chain(query, nil), do: query
  defp filter_by_chain(query, ""), do: query

  defp filter_by_chain(query, chain) when is_binary(chain) do
    CrossChainSwap.filter_by_chain_query(query, chain)
  end

  defp filter_by_chain(query, _), do: query

  defp filter_by_token(query, nil), do: query
  defp filter_by_token(query, ""), do: query

  defp filter_by_token(query, token) when is_binary(token) do
    from(s in query, where: ilike(s.token_symbol, ^"%#{token}%"))
  end

  defp filter_by_token(query, _), do: query

  defp filter_by_search(query, nil), do: query
  defp filter_by_search(query, ""), do: query

  defp filter_by_search(query, search) when is_binary(search) do
    search_term = "%#{search}%"

    from(s in query,
      where:
        ilike(fragment("?::text", s.transaction_hash), ^search_term) or
          ilike(fragment("?::text", s.user_address), ^search_term) or
          ilike(s.id, ^search_term)
    )
  end

  defp filter_by_search(query, _), do: query

  defp get_swap_stats do
    total_count = Repo.aggregate(CrossChainSwap, :count, :id)
    status_counts = CrossChainSwap.count_by_status()

    %{
      total_swaps: total_count,
      pending_swaps: Map.get(status_counts, "pending", 0),
      settled_swaps: Map.get(status_counts, "settled", 0),
      failed_swaps: Map.get(status_counts, "failed", 0)
    }
  end

  defp set_not_found_view(conn, id, message \\ "Not found") do
    conn
    |> put_status(:not_found)
    |> put_view(BlockScoutWeb.ErrorView)
    |> render("404.html", %{message: "#{message}: #{id}"})
  end
end
