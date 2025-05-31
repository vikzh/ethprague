import $ from 'jquery'
import omit from 'lodash.omit'
import humps from 'humps'
import numeral from 'numeral'
import socket from './socket'
import { connectElements } from './lib/redux_helpers'
import { createAsyncLoadStore } from './lib/random_access_pagination'
import { batchChannel } from './lib/utils'
import './app'

const BATCH_THRESHOLD = 5
const POLLING_INTERVAL = 10000 // 10 seconds

export const initialState = {
  channelDisconnected: true, // Start with polling mode
  swapsCount: null,
  swapsBatch: [],
  lastPolledAt: null
}

export function reducer(state = initialState, action) {
  switch (action.type) {
    case 'ELEMENTS_LOAD': {
      return Object.assign({}, state, omit(action, 'type'))
    }
    case 'CHANNEL_DISCONNECTED': {
      return Object.assign({}, state, {
        channelDisconnected: true,
        swapsBatch: []
      })
    }
    case 'RECEIVED_NEW_SWAP_BATCH': {
      if (state.beyondPageOne) return state

      const swapsCount = state.swapsCount + action.msgs.length

      if (!state.swapsBatch.length && action.msgs.length < BATCH_THRESHOLD) {
        return Object.assign({}, state, {
          items: [
            ...action.msgs.map(msg => msg.swapHtml).reverse(),
            ...state.items
          ],
          swapsCount,
          lastPolledAt: new Date()
        })
      } else {
        return Object.assign({}, state, {
          swapsBatch: [
            ...action.msgs.reverse(),
            ...state.swapsBatch
          ],
          swapsCount,
          lastPolledAt: new Date()
        })
      }
    }
    default:
      return state
  }
}

const elements = {
  '[data-selector="channel-disconnected-message"]': {
    render($el, state) {
      // Hide disconnected message since we're using polling by design
      $el.hide()
    }
  },
  '[data-selector="channel-batching-count"]': {
    render($el, state, _oldState) {
      const $channelBatching = $('[data-selector="channel-batching-message"]')
      if (!state.swapsBatch.length) return $channelBatching.hide()
      $channelBatching.show()
      $el[0].innerHTML = numeral(state.swapsBatch.length).format()
    }
  },
  '[data-selector="total-swaps"]': {
    load($el) {
      return { swapsCount: numeral($el.text()).value() }
    },
    render($el, state, oldState) {
      if (oldState.swapsCount === state.swapsCount) return
      $el.empty().append(numeral(state.swapsCount).format())
    }
  }
}

const $crossChainSwapPage = $('[data-page="cross-chain-swap-list"]')
if ($crossChainSwapPage.length) {
  window.onbeforeunload = () => {
    window.loading = true
  }

  const store = createAsyncLoadStore(reducer, initialState, 'dataset.identifierHash')
  
  connectElements({ store, elements })

  // Start polling for updates immediately
  console.log('🔄 Starting cross-chain swaps polling...')
  startPolling(store)

  // Handle batch click to load queued swaps
  $('[data-selector="reload-button"]').on('click', function(e) {
    e.preventDefault()
    const state = store.getState()
    if (state.swapsBatch.length > 0) {
      console.log('🔄 Loading', state.swapsBatch.length, 'queued swaps')
      
      // Clear the batch by dispatching empty batch
      store.dispatch({
        type: 'RECEIVED_NEW_SWAP_BATCH',
        msgs: state.swapsBatch
      })
      
      // Reset batch
      setTimeout(() => {
        store.dispatch({
          type: 'RECEIVED_NEW_SWAP_BATCH',
          msgs: []
        })
      }, 100)
    } else {
      // Regular reload
      window.location.reload()
    }
  })
}

function startPolling(store) {
  function poll() {
    const state = store.getState()
    if (state.beyondPageOne || window.loading) return
    
    const currentPath = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    params.set('type', 'JSON')
    params.set('polling', 'true')
    
    // Add timestamp to get only new swaps
    if (state.lastPolledAt) {
      params.set('since', state.lastPolledAt.toISOString())
    }
    
    const requestUrl = currentPath + '?' + params.toString()
    
    console.log('🔄 Polling for new swaps:', requestUrl)
    
    $.ajax({
      url: requestUrl,
      type: 'GET',
      dataType: 'json',
      timeout: 10000
    })
    .done(function(data) {
      if (data.items && data.items.length > 0) {
        console.log('📥 Received', data.items.length, 'new swaps via polling')
        
        // Convert JSON items to the expected format with swapHtml
        const msgs = data.items.map(item => ({
          swapHtml: createSwapRowHtml(item)
        }))
        
        store.dispatch({
          type: 'RECEIVED_NEW_SWAP_BATCH',
          msgs: msgs
        })
      }
    })
    .fail(function(xhr, status, error) {
      console.warn('⚠️ Polling failed:', error)
    })
  }
  
  // Poll immediately and then every interval
  poll()
  setInterval(poll, POLLING_INTERVAL)
}

function createSwapRowHtml(swap) {
  const statusBadge = getStatusBadge(swap.status)
  const chainIcons = getChainIcons(swap.source_chain, swap.destination_chain)
  const formattedAmount = formatAmount(swap.amount, swap.token_symbol)
  const shortHash = formatHash(swap.transaction_hash)
  const shortAddress = formatAddress(swap.user_address)
  
  return `
    <tr class="tile tile-type-cross-chain-swap fade-up d-none d-md-table-row"
        data-selector="swap-tile"
        data-swap-id="${swap.id}"
        data-swap-status="${swap.status}">
      <td>
        <span class="badge ${statusBadge.class}">
          ${statusBadge.text}
        </span>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <span class="${chainIcons.source} mr-1"></span>
          <small class="text-muted">${swap.source_chain}</small>
          <i class="fas fa-arrow-right mx-2 text-muted"></i>
          <span class="${chainIcons.destination} mr-1"></span>
          <small class="text-muted">${swap.destination_chain}</small>
        </div>
      </td>
      <td class="font-weight-bold">
        ${formattedAmount}
      </td>
      <td>
        <a class="text-primary font-monospace" href="/cross-chain-swaps/${swap.id}">
          ${shortHash}
        </a>
      </td>
      <td class="font-monospace">
        <a class="text-primary" data-test="address_hash_link" href="/address/${swap.user_address}">
          ${shortAddress}
        </a>
      </td>
      <td>
        <small data-from-now="${swap.inserted_at}"></small>
      </td>
    </tr>
  `
}

// Helper functions
function getStatusBadge(status) {
  switch (status) {
    case 'pending':
      return { class: 'badge-warning', text: 'Pending' }
    case 'settled':
      return { class: 'badge-success', text: 'Settled' }
    case 'failed':
      return { class: 'badge-danger', text: 'Failed' }
    default:
      return { class: 'badge-secondary', text: status }
  }
}

function getChainIcons(sourceChain, destinationChain) {
  const iconMap = {
    'TON': 'chain-icon-ton',
    'Ethereum': 'chain-icon-eth',
    'Polygon': 'chain-icon-polygon',
    'BSC': 'chain-icon-bsc'
  }
  
  return {
    source: iconMap[sourceChain] || 'chain-icon-default',
    destination: iconMap[destinationChain] || 'chain-icon-default'
  }
}

function formatAmount(amount, tokenSymbol) {
  if (!amount || amount === '0') return '—'
  return `${amount} ${tokenSymbol || ''}`
}

function formatHash(hash) {
  if (!hash) return '—'
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
}

function formatAddress(address) {
  if (!address) return '—'
  return `${address.substring(0, 8)}…${address.substring(address.length - 6)}`
}

export default $ 