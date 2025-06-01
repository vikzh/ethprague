import $ from 'jquery'
import socket from './socket'

// WebSocket-only approach - no AJAX, no pagination
// Initial data is server-rendered, WebSocket provides real-time updates

$(document).ready(function() {
  const $crossChainSwapPage = $('[data-page="cross-chain-swap-list"]')
  if (!$crossChainSwapPage.length) return
  
  console.log('🚀 Cross-chain swaps WebSocket-only initialization')
  
  // Find the swaps container where tiles are displayed
  const $swapsContainer = $('[data-selector="swaps-list"]') // Desktop table tbody
  const $swapsContainerMobile = $('[data-selector="swaps-list-mobile"]') // Mobile cards container
  
  if (!$swapsContainer.length && !$swapsContainerMobile.length) {
    console.warn('⚠️ Could not find swaps container elements')
    return
  }
  
  console.log('📦 Found swaps containers:', {
    desktop: $swapsContainer[0],
    mobile: $swapsContainerMobile[0]
  })
  
  // Connect to WebSocket channel
  const swapsChannel = socket.channel('cross_chain_swaps:new_swap')
  
  swapsChannel.join()
    .receive('ok', () => {
      console.log('✅ Connected to cross-chain swaps WebSocket channel')
    })
    .receive('error', (reason) => {
      console.error('❌ Failed to connect to WebSocket channel:', reason)
    })
  
  // Handle disconnect
  swapsChannel.onError(() => {
    console.warn('⚠️ WebSocket channel disconnected')
    $('.alert-warning.d-none').removeClass('d-none').text('Real-time updates disconnected')
  })
  
  // Handle new swap events
  swapsChannel.on('swap', (payload) => {
    console.log('📥 Received swap event via WebSocket:', payload)
    
    if (payload.swap_html && payload.swap_id) {
      // Check if this swap already exists in the DOM
      const $existingSwap = $(`[data-swap-id="${payload.swap_id}"]`)
      
      if ($existingSwap.length > 0) {
        // Update existing swap (status change)
        console.log('🔄 Updating existing swap status:', payload.swap_id)
        updateExistingSwap(payload, $existingSwap)
      } else {
        // Add new swap
        console.log('✨ Adding new swap to the containers')
        addNewSwap(payload)
      }
      
    } else {
      console.warn('⚠️ Received swap event without HTML content or swap_id:', payload)
    }
  })
  
  // Function to add new swap to containers
  function addNewSwap(payload) {
    // Create jQuery element from the HTML
    const $newSwapElements = $(payload.swap_html)
    
    // Remove empty state message if it exists
    $swapsContainer.find('tr:contains("No cross-chain swaps found.")').remove()
    $swapsContainerMobile.find('.tile:contains("There are no cross-chain swaps.")').remove()
    
    // Add to desktop table if it exists
    if ($swapsContainer.length) {
      // Find the <tr> element for desktop
      const $desktopRow = $newSwapElements.filter('tr')
      if ($desktopRow.length) {
        $swapsContainer.prepend($desktopRow)
      }
    }
    
    // Add to mobile container if it exists  
    if ($swapsContainerMobile.length) {
      // Find the mobile div element
      const $mobileCard = $newSwapElements.filter('div.tile')
      if ($mobileCard.length) {
        $swapsContainerMobile.prepend($mobileCard)
      }
    }
    
    // Update swap count if element exists
    const $totalSwaps = $('[data-selector="total-swaps"]')
    if ($totalSwaps.length) {
      const currentCount = parseInt($totalSwaps.text().replace(/,/g, '')) || 0
      $totalSwaps.text((currentCount + 1).toLocaleString())
    }
    
    // Update status-specific count
    const newStatus = getSwapStatus($newSwapElements)
    if (newStatus) {
      incrementStatusCount(newStatus)
    }
  }
  
  // Function to update existing swap with new status
  function updateExistingSwap(payload, $existingSwap) {
    const $newSwapElements = $(payload.swap_html)
    
    // Get old and new status for count updates
    const oldStatus = getSwapStatus($existingSwap)
    const newStatus = getSwapStatus($newSwapElements)
    
    // Update desktop version if it exists
    const $existingDesktop = $existingSwap.filter('tr')
    const $newDesktop = $newSwapElements.filter('tr')
    if ($existingDesktop.length && $newDesktop.length) {
      $existingDesktop.replaceWith($newDesktop)
    }
    
    // Update mobile version if it exists
    const $existingMobile = $existingSwap.filter('div.tile')
    const $newMobile = $newSwapElements.filter('div.tile')
    if ($existingMobile.length && $newMobile.length) {
      $existingMobile.replaceWith($newMobile)
    }
    
    // Update status counts if status changed
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      decrementStatusCount(oldStatus)
      incrementStatusCount(newStatus)
    }
  }
  
  // Helper function to extract status from swap elements
  function getSwapStatus($swapElements) {
    // Try to get status from data attribute first
    let status = $swapElements.attr('data-swap-status')
    if (status) return status
    
    // Fallback: try to extract from badge text
    const $badge = $swapElements.find('.badge')
    if ($badge.length) {
      const badgeText = $badge.text().trim().toLowerCase()
      if (badgeText.includes('pending')) return 'pending'
      if (badgeText.includes('completed')) return 'completed'
      if (badgeText.includes('created')) return 'created'
    }
    
    return null
  }
  
  // Helper function to increment status count
  function incrementStatusCount(status) {
    const $counter = $(`[data-selector="${status}-swaps"]`)
    if ($counter.length) {
      const currentCount = parseInt($counter.text().replace(/,/g, '')) || 0
      $counter.text((currentCount + 1).toLocaleString())
    }
  }
  
  // Helper function to decrement status count
  function decrementStatusCount(status) {
    const $counter = $(`[data-selector="${status}-swaps"]`)
    if ($counter.length) {
      const currentCount = parseInt($counter.text().replace(/,/g, '')) || 0
      const newCount = Math.max(0, currentCount - 1)
      $counter.text(newCount.toLocaleString())
    }
  }
  
  console.log('🎯 WebSocket-only cross-chain swaps setup complete')
})

export default $ 