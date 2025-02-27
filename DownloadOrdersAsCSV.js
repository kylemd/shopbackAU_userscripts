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

    async function getOrderDetails(order) {
        const viewMoreButton = order.querySelector('button');
        if (!viewMoreButton) return null;

        viewMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const details = {
            paymentMethod: document.querySelector('.MuiDialog-root .MuiDialogContent-root div:nth-child(4) div:nth-child(1) p:nth-child(2) div')?.textContent?.trim().replace(/^-$/, '') || '',
            subtotal: document.querySelector('.MuiDialog-root .MuiDialogContent-root div:nth-child(4) div:nth-child(2) p:nth-child(2)')?.textContent?.trim(),
            cashbackUsed: document.querySelector('.MuiDialog-root .MuiDialogContent-root div:nth-child(4) div:nth-child(3) p:nth-child(2)')?.textContent?.trim(),
            totalPaid: document.querySelector('.MuiDialog-root .MuiDialogContent-root div:nth-child(4) div:nth-child(4) p:nth-child(2) strong')?.textContent?.trim()
        };

        // Close modal by clicking outside
        const modalBackdrop = document.querySelector('.MuiDialog-root');
        if (modalBackdrop) {
            modalBackdrop.click();
        }
        await new Promise(resolve => setTimeout(resolve, 500));

        return details;
    }

    // Add helper function to convert currency string to number
    function currencyToNumber(currencyStr) {
        if (!currencyStr) return 0;
        return parseFloat(currencyStr.replace(/[$,]/g, '')) || 0;
    }

    async function loadAllOrders() {
        let lastHeight = 0;
        let currentHeight = document.documentElement.scrollHeight;

        // Scroll to bottom until no new content loads
        while (lastHeight !== currentHeight) {
            lastHeight = currentHeight;
            window.scrollTo(0, document.documentElement.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 2000));
            currentHeight = document.documentElement.scrollHeight;
        }

        // Get all orders
        const orders = Array.from(document.querySelectorAll('section.flex_1 > div > div > div > div'));
        const orderData = [];

        // Process each order
        for (const order of orders) {
            try {
                const orderId = order.querySelector('[class*="fs_sbds-global-font-size-4"]').textContent.trim();
                
                const dateStr = order.querySelector('[class*="fs_sbds-global-font-size-3"]').textContent.trim();
                // Split date parts, handling no space before AM/PM
                const dateParts = dateStr.match(/(\d+)\s+(\w+)\s+(\d+)\s+(\d+:\d+)(AM|PM)/);
                const [_, day, month, year, timeStr, period] = dateParts;
                
                // Convert 12-hour to 24-hour time
                let [hours, minutes] = timeStr.split(':');
                hours = parseInt(hours);
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

                // Get additional details from modal
                const modalDetails = await getOrderDetails(order);

                // Convert monetary values to numbers for calculation
                const subtotalNum = currencyToNumber(modalDetails?.subtotal);
                const cashbackUsedNum = currencyToNumber(modalDetails?.cashbackUsed);
                const totalPaidNum = currencyToNumber(modalDetails?.totalPaid);

                // Calculate promos (negative value means discount applied)
                const promosAmount = totalPaidNum - (subtotalNum + cashbackUsedNum);
                const promos = promosAmount !== 0 ? `$${promosAmount.toFixed(2)}` : '';

                orderData.push({
                    orderId,
                    date: formattedDate,
                    total,
                    status,
                    itemName,
                    quantity,
                    paymentMethod: modalDetails?.paymentMethod || '',
                    subtotal: modalDetails?.subtotal || '',
                    cashbackUsed: modalDetails?.cashbackUsed || '',
                    promos,
                    totalPaid: modalDetails?.totalPaid || ''
                });
            } catch (error) {
                console.error('Error processing order:', error);
                // Continue with next order if one fails
                continue;
            }
        }

        return orderData;
    }

    // Handle click event
    button.addEventListener('click', async () => {
        button.disabled = true;
        button.innerHTML = 'Loading orders...';

        try {
            const orders = await loadAllOrders();
            
            // Convert to CSV
            const headers = ['Order ID', 'Date', 'Total', 'Status', 'Item Name', 'Quantity', 'Payment Method', 'Subtotal', 'Cashback Used', 'Promos', 'Total Paid'];
            const csv = [
                headers.join(','),
                ...orders.map(order => [
                    order.orderId,
                    order.date,
                    order.total,
                    order.status,
                    order.itemName,
                    order.quantity,
                    order.paymentMethod,
                    order.subtotal,
                    order.cashbackUsed,
                    order.promos,
                    order.totalPaid
                ].join(','))
            ].join('\n');

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', 'shopback_orders.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            button.disabled = false;
            button.innerHTML = 'Download as CSV';
        }
    });
})();
