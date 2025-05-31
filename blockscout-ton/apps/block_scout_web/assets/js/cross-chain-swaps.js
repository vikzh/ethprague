import $ from 'jquery'
import omit from 'lodash.omit'
import URI from 'urijs'

// Cross-Chain Swaps page functionality
$(document).ready(function() {
  
  // Configuration
  const REFRESH_INTERVAL = 5000 // 5 seconds
  let refreshTimer = null
  let currentPath = window.location.pathname
  let currentParams = new URLSearchParams(window.location.search)
  
  // DOM elements
  const $autoRefreshToggle = $('#auto-refresh-toggle')
  const $statusFilter = $('#status-filter')
  const $chainFilter = $('#chain-filter')
  const $tokenFilter = $('#token-filter')
  const $searchFilter = $('#search-filter')
  const $swapsList = $('[data-selector="swaps-list"]')
  const $swapsListMobile = $('[data-selector="swaps-list-mobile"]')
  const $errorMessage = $('[data-error-message]')
  const $emptyMessage = $('[data-empty-response-message]')
  const $statsElements = {
    total: $('[data-selector="total-swaps"]'),
    pending: $('[data-selector="pending-swaps"]'),
    settled: $('[data-selector="settled-swaps"]'),
    failed: $('[data-selector="failed-swaps"]'),
    successRate: $('[data-selector="success-rate"]')
  }
  
  // Initialize
  initializeFilters()
  initializeAutoRefresh()
  initializeEventHandlers()
  
  function initializeFilters() {
    // Set initial filter values from URL
    const urlParams = new URLSearchParams(window.location.search)
    
    if (urlParams.get('status')) {
      $statusFilter.val(urlParams.get('status'))
    }
    if (urlParams.get('chain')) {
      $chainFilter.val(urlParams.get('chain'))
    }
    if (urlParams.get('token')) {
      $tokenFilter.val(urlParams.get('token'))
    }
    if (urlParams.get('search')) {
      $searchFilter.val(urlParams.get('search'))
    }
  }
  
  function initializeAutoRefresh() {
    if ($autoRefreshToggle.is(':checked')) {
      startAutoRefresh()
    }
  }
  
  function initializeEventHandlers() {
    // Auto-refresh toggle
    $autoRefreshToggle.on('change', function() {
      if ($(this).is(':checked')) {
        startAutoRefresh()
      } else {
        stopAutoRefresh()
      }
    })
    
    // Filter handlers
    $statusFilter.on('change', handleFilterChange)
    $chainFilter.on('input', debounce(handleFilterChange, 500))
    $tokenFilter.on('input', debounce(handleFilterChange, 500))
    $searchFilter.on('input', debounce(handleFilterChange, 500))
    
    // Error message click to retry
    $errorMessage.on('click', function() {
      loadSwaps()
    })
    
    // Reload button click
    $('[data-selector="reload-button"]').on('click', function(e) {
      e.preventDefault()
      loadSwaps()
    })
  }
  
  function startAutoRefresh() {
    stopAutoRefresh() // Clear any existing timer
    refreshTimer = setInterval(function() {
      loadSwaps(true) // silent refresh
    }, REFRESH_INTERVAL)
  }
  
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }
  
  function handleFilterChange() {
    // Build new URL with filters
    const params = new URLSearchParams()
    
    const status = $statusFilter.val()
    const chain = $chainFilter.val().trim()
    const token = $tokenFilter.val().trim()
    const search = $searchFilter.val().trim()
    
    if (status && status !== 'all') {
      params.set('status', status)
    }
    if (chain) {
      params.set('chain', chain)
    }
    if (token) {
      params.set('token', token)
    }
    if (search) {
      params.set('search', search)
    }
    
    // Update URL without page reload
    const newUrl = currentPath + (params.toString() ? '?' + params.toString() : '')
    window.history.pushState({}, '', newUrl)
    currentParams = params
    
    // Load filtered results
    loadSwaps()
  }
  
  function loadSwaps(silent = false) {
    // Show loading state (unless silent)
    if (!silent) {
      showLoading()
    }
    
    // Hide error/empty messages
    $errorMessage.hide()
    $emptyMessage.hide()
    
    // Build request URL
    const params = new URLSearchParams(currentParams)
    params.set('type', 'JSON')
    
    const requestUrl = currentPath + '?' + params.toString()
    
    $.ajax({
      url: requestUrl,
      type: 'GET',
      dataType: 'json',
      timeout: 10000
    })
    .done(function(data) {
      updateSwapsList(data.items)
      updatePagination(data.next_page_params)
      
      // Update stats if provided
      if (data.stats) {
        updateStats(data.stats)
      }
      
      if (!silent) {
        hideLoading()
      }
      
      // Show empty message if no items
      if (!data.items || data.items.length === 0) {
        $emptyMessage.show()
      }
    })
    .fail(function(xhr, status, error) {
      if (!silent) {
        hideLoading()
        showError()
      }
      console.error('Failed to load swaps:', error)
    })
  }
  
  function updateSwapsList(items) {
    if (!items || items.length === 0) {
      $swapsList.empty()
      $swapsListMobile.empty()
      return
    }
    
    // Parse items and separate desktop/mobile
    const $desktopItems = $()
    const $mobileItems = $()
    
    items.forEach(function(item) {
      const $item = $(item)
      const $desktopItem = $item.find('.d-md-table-row, .d-none.d-md-block')
      const $mobileItem = $item.find('.d-md-none')
      
      if ($desktopItem.length) {
        $desktopItems.add($desktopItem)
      }
      if ($mobileItem.length) {
        $mobileItems.add($mobileItem)
      }
    })
    
    // Update lists
    $swapsList.html($desktopItems)
    $swapsListMobile.html($mobileItems)
    
    // Update timestamps
    updateTimestamps()
  }
  
  function updatePagination(nextPageParams) {
    // Update pagination if needed
    // This would integrate with Blockscout's existing pagination system
    // For now, we'll keep it simple
  }
  
  function updateStats(stats) {
    if ($statsElements.total.length) {
      $statsElements.total.text(stats.total_swaps || 0)
    }
    if ($statsElements.pending.length) {
      $statsElements.pending.text(stats.pending_swaps || 0)
    }
    if ($statsElements.settled.length) {
      $statsElements.settled.text(stats.settled_swaps || 0)
    }
    if ($statsElements.failed.length) {
      $statsElements.failed.text(stats.failed_swaps || 0)
    }
    if ($statsElements.successRate.length && stats.total_swaps > 0) {
      const rate = ((stats.settled_swaps || 0) / stats.total_swaps * 100).toFixed(1)
      $statsElements.successRate.text(rate + '%')
    }
  }
  
  function updateTimestamps() {
    // Update relative timestamps using Blockscout's existing functionality
    $('[data-from-now]').each(function() {
      const $this = $(this)
      const timestamp = $this.data('from-now')
      if (timestamp && window.fromNow) {
        $this.text(window.fromNow(timestamp))
      }
    })
  }
  
  function showLoading() {
    // Show Blockscout's tile loader
    const loader = '<div data-selector="loading-animation" class="tile-loader"><div class="loading-spinner"><div class="loading-spinner-icon"></div></div></div>'
    $swapsList.html(loader)
    $swapsListMobile.html(loader)
  }
  
  function hideLoading() {
    $('[data-selector="loading-animation"]').remove()
  }
  
  function showError() {
    $errorMessage.show()
  }
  
  // Utility function for debouncing
  function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }
  
  // Copy to clipboard functionality
  $(document).on('click', '[data-clipboard-target]', function(e) {
    e.preventDefault()
    const target = $(this).data('clipboard-target')
    const $target = $(target)
    if ($target.length) {
      const text = $target.data('clipboard-text') || $target.text()
      navigator.clipboard.writeText(text).then(function() {
        // Show success feedback
        const $button = $(e.target)
        const originalHtml = $button.html()
        $button.html('<i class="fas fa-check"></i>')
        setTimeout(function() {
          $button.html(originalHtml)
        }, 2000)
      }).catch(function(err) {
        console.error('Failed to copy text: ', err)
      })
    }
  })
  
  // Initial load if we're on the index page
  if (window.location.pathname.includes('/cross-chain-swaps') && 
      !window.location.pathname.includes('/cross-chain-swaps/')) {
    loadSwaps()
  }
  
  // Cleanup on page unload
  $(window).on('beforeunload', function() {
    stopAutoRefresh()
  })
})

export default $ 