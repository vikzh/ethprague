defmodule Explorer.Chain.CrossChainSwap do
  @moduledoc """
  A stored representation of cross-chain swap operations.

  Represents swaps between different blockchain networks, primarily focusing on
  TON as the source chain with various destination chains.
  """

  use Explorer.Schema

  alias Explorer.Chain.Hash
  alias Explorer.PagingOptions

  @required_attrs ~w(source_chain_name destination_chain_name transaction_hash status)a
  @optional_attrs ~w(amount token_symbol user_address settlement_tx_hash metadata error_message retry_count)a

  @status_values ~w(pending settled failed)

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  typed_schema "cross_chain_swaps" do
    field(:source_chain_name, :string, default: "TON")
    field(:destination_chain_name, :string)
    field(:transaction_hash, :string)
    field(:status, :string, default: "pending")
    field(:amount, :decimal)
    field(:token_symbol, :string)
    field(:user_address, :string)
    field(:settlement_tx_hash, :string)
    field(:metadata, :map, default: %{})
    field(:error_message, :string)
    field(:retry_count, :integer, default: 0)

    timestamps()
  end

  @spec changeset(
          Explorer.Chain.CrossChainSwap.t(),
          :invalid | %{optional(:__struct__) => none, optional(atom | binary) => any}
        ) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = swap, attrs \\ %{}) do
    swap
    |> cast(attrs, @required_attrs ++ @optional_attrs)
    |> validate_required(@required_attrs)
    |> validate_inclusion(:status, @status_values)
    |> validate_number(:amount, greater_than: 0)
    |> validate_number(:retry_count, greater_than_or_equal_to: 0)
    |> unique_constraint(:transaction_hash, name: :cross_chain_swaps_transaction_hash_index)
  end

  @spec page_swaps(Ecto.Query.t(), PagingOptions.t()) :: Ecto.Query.t()
  def page_swaps(query, %PagingOptions{key: nil}), do: query

  def page_swaps(query, %PagingOptions{key: {inserted_at, id}}) do
    where(
      query,
      [swap],
      swap.inserted_at < ^inserted_at or (swap.inserted_at == ^inserted_at and swap.id < ^id)
    )
  end

  @spec list_swaps_query() :: Ecto.Query.t()
  def list_swaps_query do
    from(swap in __MODULE__,
      select: swap,
      order_by: [desc: :inserted_at, desc: :id]
    )
  end

  @spec filter_by_status_query(Ecto.Query.t(), String.t()) :: Ecto.Query.t()
  def filter_by_status_query(query, status) when status in @status_values do
    where(query, [swap], swap.status == ^status)
  end

  def filter_by_status_query(query, _), do: query

  @spec filter_by_chain_query(Ecto.Query.t(), String.t()) :: Ecto.Query.t()
  def filter_by_chain_query(query, chain_name) do
    where(
      query,
      [swap],
      swap.source_chain_name == ^chain_name or swap.destination_chain_name == ^chain_name
    )
  end

  @spec pending_swaps_query() :: Ecto.Query.t()
  def pending_swaps_query do
    from(swap in __MODULE__,
      select: swap,
      where: swap.status == "pending",
      order_by: [asc: :inserted_at]
    )
  end

  @spec increment_retry_count(String.t()) :: {:ok, __MODULE__.t()} | {:error, Ecto.Changeset.t()}
  def increment_retry_count(swap_id) do
    from(swap in __MODULE__, where: swap.id == ^swap_id)
    |> Explorer.Repo.update_all(inc: [retry_count: 1], set: [updated_at: DateTime.utc_now()])
    |> case do
      {1, _} -> {:ok, %__MODULE__{}}
      _ -> {:error, :not_found}
    end
  end

  @spec update_status(String.t(), String.t(), map()) ::
          {:ok, __MODULE__.t()} | {:error, Ecto.Changeset.t()}
  def update_status(swap_id, new_status, additional_attrs \\ %{})
      when new_status in ["pending", "settled", "failed"] do
    updates =
      additional_attrs
      |> Map.put(:status, new_status)
      |> Map.put(:updated_at, DateTime.utc_now())

    from(swap in __MODULE__, where: swap.id == ^swap_id)
    |> Explorer.Repo.update_all(set: Enum.to_list(updates))
    |> case do
      {1, _} -> {:ok, %__MODULE__{}}
      _ -> {:error, :not_found}
    end
  end

  @spec count_by_status() :: %{String.t() => non_neg_integer()}
  def count_by_status do
    from(swap in __MODULE__,
      select: {swap.status, count(swap.id)},
      group_by: swap.status
    )
    |> Explorer.Repo.all()
    |> Enum.into(%{})
  end

  @spec status_values() :: [String.t()]
  def status_values, do: @status_values
end
