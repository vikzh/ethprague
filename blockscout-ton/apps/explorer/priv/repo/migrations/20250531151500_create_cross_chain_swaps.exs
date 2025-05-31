defmodule Explorer.Repo.Migrations.CreateCrossChainSwaps do
  use Ecto.Migration

  def change do
    create table(:cross_chain_swaps, primary_key: false) do
      add(:id, :uuid, primary_key: true, default: fragment("gen_random_uuid()"))
      add(:source_chain_name, :string, null: false, default: "TON")
      add(:destination_chain_name, :string, null: false)
      add(:transaction_hash, :bytea, null: false)
      add(:status, :string, null: false, default: "pending")
      add(:amount, :numeric, precision: 100)
      add(:token_symbol, :string)
      add(:user_address, :bytea)
      add(:settlement_tx_hash, :bytea, null: true)
      add(:metadata, :map, default: %{})
      add(:error_message, :string, null: true)
      add(:retry_count, :integer, default: 0)

      timestamps(null: false, type: :utc_datetime_usec)
    end

    create(index(:cross_chain_swaps, [:status]))
    create(index(:cross_chain_swaps, [:source_chain_name]))
    create(index(:cross_chain_swaps, [:transaction_hash]))
    create(index(:cross_chain_swaps, [:user_address]))
    create(index(:cross_chain_swaps, [:inserted_at]))
  end
end
