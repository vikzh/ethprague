defmodule BlockScoutWeb.CrossChainSwapChannel do
  @moduledoc """
  Establishes pub/sub channel for live updates of cross-chain swap events.
  """
  use BlockScoutWeb, :channel

  alias BlockScoutWeb.CrossChainSwapView
  alias Explorer.Chain.CrossChainSwap
  alias Phoenix.View

  intercept(["swap"])

  def join("cross_chain_swaps:new_swap", _params, socket) do
    {:ok, %{}, socket}
  end

  def handle_out(
        "swap",
        %{swap: swap},
        %Phoenix.Socket{handler: BlockScoutWeb.UserSocket} = socket
      ) do
    Gettext.put_locale(BlockScoutWeb.Gettext, socket.assigns.locale)

    rendered_swap =
      View.render_to_string(
        CrossChainSwapView,
        "_swap_tile.html",
        swap: swap,
        conn: socket
      )

    push(socket, "swap", %{
      swap_id: swap.id,
      swap_html: rendered_swap
    })

    {:noreply, socket}
  end

  def handle_out("swap", _, socket) do
    {:noreply, socket}
  end
end
