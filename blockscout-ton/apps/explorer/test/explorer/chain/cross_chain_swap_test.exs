defmodule Explorer.Chain.CrossChainSwapTest do
  use Explorer.DataCase, async: true

  alias Explorer.Chain.CrossChainSwap

  describe "changeset/2" do
    test "with valid attributes" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "pending",
        amount: Decimal.new("100.5"),
        token_symbol: "USDT",
        user_address: "0x" <> String.duplicate("b", 40)
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      assert changeset.valid?
    end

    test "requires destination_chain_name" do
      attrs = %{
        source_chain_name: "TON",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "pending"
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      refute changeset.valid?
      errors = changeset_errors(changeset)
      assert "can't be blank" in errors.destination_chain_name
    end

    test "requires transaction_hash" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        status: "pending"
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      refute changeset.valid?
      errors = changeset_errors(changeset)
      assert "can't be blank" in errors.transaction_hash
    end

    test "validates status inclusion" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "invalid_status"
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      refute changeset.valid?
      errors = changeset_errors(changeset)
      assert "is invalid" in errors.status
    end

    test "validates amount is positive" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "pending",
        amount: Decimal.new("-10")
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      refute changeset.valid?
      errors = changeset_errors(changeset)
      assert "must be greater than 0" in errors.amount
    end

    test "validates retry_count is non-negative" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "pending",
        retry_count: -1
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      refute changeset.valid?
      errors = changeset_errors(changeset)
      assert "must be greater than or equal to 0" in errors.retry_count
    end

    test "accepts valid metadata" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "pending",
        metadata: %{"bridge_type" => "atomic_swap", "priority" => "high"}
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      assert changeset.valid?
    end
  end

  describe "basic functionality" do
    test "count_by_status/0 returns empty map when no swaps exist" do
      counts = CrossChainSwap.count_by_status()
      assert counts == %{}
    end

    test "list_swaps_query/0 returns query for all swaps" do
      query = CrossChainSwap.list_swaps_query()
      assert is_struct(query, Ecto.Query)
    end

    test "pending_swaps_query/0 returns query for pending swaps" do
      query = CrossChainSwap.pending_swaps_query()
      assert is_struct(query, Ecto.Query)
    end

    test "status_values/0 returns valid status values" do
      assert CrossChainSwap.status_values() == ["pending", "settled", "failed"]
    end

    test "can create swap with valid attrs directly in database" do
      attrs = %{
        source_chain_name: "TON",
        destination_chain_name: "Ethereum",
        transaction_hash: "0x" <> String.duplicate("a", 64),
        status: "pending",
        amount: Decimal.new("100.5"),
        token_symbol: "USDT",
        user_address: "0x" <> String.duplicate("b", 40)
      }

      changeset = CrossChainSwap.changeset(%CrossChainSwap{}, attrs)
      assert changeset.valid?

      {:ok, swap} = Repo.insert(changeset)
      assert swap.id
      assert swap.status == "pending"
      assert swap.source_chain_name == "TON"
    end
  end
end
