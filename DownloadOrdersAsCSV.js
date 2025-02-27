// ==UserScript==
// @name         Shopback Order History CSV Export
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Export Shopback order history to CSV
// @author       kylemd
// @match        https://www.shopback.com.au/ecommerce/order-history*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create floating button
    const button = document.createElement('button');
    button.innerHTML = 'Download as CSV';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background-color: #ff4e4e;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    // Add button to page
    document.body.appendChild(button);

    // Handle click event
    button.addEventListener('click', async () => {
        try {
            // Visual feedback
            button.innerHTML = 'Loading...';
            button.disabled = true;

            // Function to load all orders
            async function loadAllOrders() {
                const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
                let previousHeight = 0;
                
                while (true) {
                    window.scrollTo(0, document.documentElement.scrollHeight);
                    await delay(1500); // Increased delay for reliability
                    
                    const currentHeight = document.documentElement.scrollHeight;
                    if (currentHeight === previousHeight) {
                        break;
                    }
                    previousHeight = currentHeight;
                }
                
                // Scroll back to top and wait for final render
                window.scrollTo(0, 0);
                await delay(1000);
                
                return document.querySelectorAll('[class*="d_flex border_solid_1px_"]');
            }

            // Load all orders and wait for completion
            const orders = await loadAllOrders();
            
            // Prepare CSV data
            const csvRows = [['Order ID', 'Date', 'Total', 'Status', 'Item Name', 'Quantity']];

            // Process each order
            orders.forEach(order => {
                const orderId = order.querySelector('[class*="fs_sbds-global-font-size-4"]').textContent.trim();
                
                const dateStr = order.querySelector('[class*="fs_sbds-global-font-size-3"]').textContent.trim();
                // Split date parts, handling no space before AM/PM
                const dateParts = dateStr.match(/(\d+)\s+(\w+)\s+(\d+)\s+(\d+:\d+)(AM|PM)/);
                const [_, day, month, year, timeStr, period] = dateParts;
                
                // Convert 12-hour to 24-hour time
                let [hours, minutes] = timeStr.split(':');
                hours = parseInt(hours);
                // Convert to 24-hour format
                if (period === 'PM' && hours !== 12) {
                    hours += 12;
                } else if (period === 'AM' && hours === 12) {
                    hours = 0;
                }
                
                // Format date with 24-hour time
                const formattedDate = `${day.padStart(2, '0')}-${month}-${year} ${hours.toString().padStart(2, '0')}:${minutes}`;
                
                const total = order.querySelector('p[class*="fs_sbds-global-font-size-4"]:last-of-type').textContent.trim().replace('Total: ', '');
                const status = order.querySelector('[class*="bg_sbds-status-color-success-lighter"]').textContent.trim();
                const itemName = order.querySelector('[class*="-webkit-line-clamp_1"]').textContent.trim().replace(/,/g, '');
                const quantity = order.querySelector('[class*="flex_0_0_auto"]').textContent.trim().replace('x', '');

                csvRows.push([orderId, formattedDate, total, status, itemName, quantity]);
            });

            // Generate and download CSV
            const csvContent = csvRows.map(row => row.join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'shopback_orders.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error:', error);
            alert('Error processing orders. Check console for details.');
        } finally {
            // Reset button state
            button.innerHTML = 'Download as CSV';
            button.disabled = false;
        }
    });
})();