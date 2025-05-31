# Script for populating cross-chain swaps mock data
#
# You can run it as:
#     mix run priv/repo/seeds/cross_chain_swaps_seeds.exs
#
# This will create sample cross-chain swap data for development and testing

alias Explorer.Chain.CrossChainSwap
alias Explorer.Repo

# Helper function to generate random transaction hashes
defmodule CrossChainSwapSeeds do
  def random_hash_binary do
    :crypto.strong_rand_bytes(32)
  end

  def random_address_binary do
    :crypto.strong_rand_bytes(20)
  end

  def random_amount do
    Enum.random([
      Decimal.new("100.5"),
      Decimal.new("1000.0"),
      Decimal.new("50.25"),
      Decimal.new("2500.75"),
      Decimal.new("10000.0"),
      Decimal.new("250.5")
    ])
  end

  def random_status do
    Enum.random(["pending", "settled", "failed"])
  end

  def random_chain do
    Enum.random(["Ethereum", "Polygon", "BSC", "Arbitrum", "Optimism"])
  end

  def random_token do
    Enum.random(["USDT", "USDC", "TON", "ETH", "BTC", "MATIC"])
  end

  def create_swap_data do
    %{
      source_chain_name: "TON",
      destination_chain_name: random_chain(),
      transaction_hash: random_hash_binary(),
      status: random_status(),
      amount: random_amount(),
      token_symbol: random_token(),
      user_address: random_address_binary(),
      settlement_tx_hash: if(Enum.random([true, false]), do: random_hash_binary(), else: nil),
      metadata: %{
        "bridge_type" => Enum.random(["atomic_swap", "lock_and_mint", "burn_and_mint"]),
        "priority" => Enum.random(["high", "medium", "low"]),
        "fee_amount" => "#{Enum.random(1..50)}.#{Enum.random(10..99)}"
      },
      error_message: if(Enum.random([true, false, false]), do: "Sample error message", else: nil),
      retry_count: Enum.random(0..3),
      inserted_at: DateTime.utc_now(),
      updated_at: DateTime.utc_now()
    }
  end
end

# Clear existing data
IO.puts("Clearing existing cross-chain swap data...")
Repo.delete_all(CrossChainSwap)

# Create new mock data
IO.puts("Creating cross-chain swap mock data...")

for _i <- 1..15 do
  swap_data = CrossChainSwapSeeds.create_swap_data()
  changeset = CrossChainSwap.changeset(%CrossChainSwap{}, swap_data)

  case Repo.insert(changeset) do
    {:ok, _swap} ->
      :ok

    {:error, changeset} ->
      IO.inspect(changeset.errors, label: "Error creating swap")
  end
end

IO.puts("Cross-chain swap mock data created successfully!")

# Display summary
counts = CrossChainSwap.count_by_status()
IO.puts("Summary:")
IO.puts("  Pending: #{counts["pending"] || 0}")
IO.puts("  Settled: #{counts["settled"] || 0}")
IO.puts("  Failed: #{counts["failed"] || 0}")
IO.puts("  Total: #{Repo.aggregate(CrossChainSwap, :count, :id)}")
