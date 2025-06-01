defmodule BlockScoutWeb.CrossChainSwapController do
  use BlockScoutWeb, :controller

  require Logger

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
    try do
      Logger.info("Processing JSON request for cross-chain swaps with params: #{inspect(params)}")

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

      Logger.info("Executing database query for swaps")
      swaps_plus_one = query |> Chain.select_repo(full_options).all()

      Logger.info("Retrieved #{length(swaps_plus_one)} swaps from database")

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

      Logger.info("About to render #{length(swaps)} swaps as HTML tiles")

      # Return rendered HTML tiles for pagination system
      json(
        conn,
        %{
          items:
            Enum.map(swaps, fn swap ->
              View.render_to_string(
                CrossChainSwapView,
                "_tile.html",
                swap: swap,
                conn: conn
              )
            end),
          next_page_params: next_page_params
        }
      )
    rescue
      error ->
        Logger.error("Critical error in cross-chain swaps index/JSON: #{inspect(error)}")
        Logger.error("Error type: #{error.__struct__}")
        Logger.error("Request params: #{inspect(params)}")
        Logger.error("Stack trace: #{Exception.format_stacktrace(__STACKTRACE__)}")

        conn
        |> put_status(500)
        |> json(%{
          error: "Internal server error",
          message: Exception.message(error),
          type: to_string(error.__struct__)
        })
    end
  end

  def index(conn, params) do
    # Main HTML page
    try do
      Logger.info("Processing HTML request for cross-chain swaps with params: #{inspect(params)}")

      current_filter = Map.get(params, "filter", "all")

      # Get stats for the header
      Logger.info("Getting swap stats")
      stats = calculate_stats()
      Logger.info("Retrieved stats: #{inspect(stats)}")

      # Get swaps for initial render
      Logger.info("Loading swaps for initial render")
      options = @default_options |> Keyword.merge(paging_options(params))

      query = CrossChainSwap.list_swaps_query() |> apply_filters(params)
      swaps_plus_one = query |> Chain.select_repo(options).all()
      {swaps, next_page} = split_list_by_page(swaps_plus_one)

      next_page_params = next_page |> next_page_params(swaps, params)

      Logger.info("Loaded #{length(swaps)} swaps for initial render")

      render(
        conn,
        "index.html",
        current_path: Controller.current_full_path(conn),
        current_user: current_user(conn),
        current_filter: current_filter,
        stats: stats,
        swaps: swaps,
        next_page_params: next_page_params
      )
    rescue
      error ->
        Logger.error("Critical error in cross-chain swaps index/HTML: #{inspect(error)}")
        Logger.error("Error type: #{error.__struct__}")
        Logger.error("Request params: #{inspect(params)}")
        Logger.error("Stack trace: #{Exception.format_stacktrace(__STACKTRACE__)}")

        conn
        |> put_status(500)
        |> put_view(BlockScoutWeb.ErrorView)
        |> render("500.html", %{message: Exception.message(error)})
    end
  end

  def show(conn, %{"id" => id} = params) do
    try do
      Logger.info("Processing show request for swap ID: #{id}")

      with {:ok, _uuid} <- Ecto.UUID.cast(id),
           %CrossChainSwap{} = swap <- Repo.get(CrossChainSwap, id),
           {:ok, false} <- AccessHelper.restricted_access?(to_string(swap.user_address), params) do
        Logger.info("Successfully retrieved swap: #{swap.id}")
        Logger.info("Swap transaction_hash: #{inspect(swap.transaction_hash)}")
        Logger.info("Swap structure: #{inspect(swap, limit: :infinity)}")

        render(
          conn,
          "show.html",
          current_path: Controller.current_full_path(conn),
          current_user: current_user(conn),
          swap: swap
        )
      else
        :error ->
          Logger.warn("Invalid UUID format for swap ID: #{id}")
          set_not_found_view(conn, id, "Invalid swap ID format")

        nil ->
          Logger.warn("Swap not found: #{id}")
          set_not_found_view(conn, id, "Cross-chain swap not found")

        {:restricted_access, _} ->
          Logger.warn("Access restricted for swap: #{id}")
          set_not_found_view(conn, id, "Access restricted")
      end
    rescue
      error ->
        Logger.error("Critical error in cross-chain swap show: #{inspect(error)}")
        Logger.error("Error type: #{error.__struct__}")
        Logger.error("Swap ID: #{id}")
        Logger.error("Request params: #{inspect(params)}")
        Logger.error("Stack trace: #{Exception.format_stacktrace(__STACKTRACE__)}")

        conn
        |> put_status(500)
        |> put_view(BlockScoutWeb.ErrorView)
        |> render("500.html", %{message: Exception.message(error)})
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

  defp filter_by_status(query, status) when status in ["created", "pending", "completed"] do
    from(swap in query, where: swap.status == ^status)
  end

  defp filter_by_status(query, _status), do: query

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

  defp calculate_stats do
    # Get status counts
    status_counts =
      from(s in CrossChainSwap,
        group_by: s.status,
        select: {s.status, count(s.id)}
      )
      |> Repo.all()
      |> Enum.into(%{})

    total_swaps = Enum.sum(Map.values(status_counts))

    %{
      total_swaps: total_swaps,
      pending_swaps: Map.get(status_counts, "pending", 0),
      completed_swaps: Map.get(status_counts, "completed", 0),
      created_swaps: Map.get(status_counts, "created", 0)
    }
  end

  defp set_not_found_view(conn, id, message) do
    conn
    |> put_status(:not_found)
    |> put_view(BlockScoutWeb.ErrorView)
    |> render("404.html", %{message: "#{message}: #{id}"})
  end
end
