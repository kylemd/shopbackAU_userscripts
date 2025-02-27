// ==UserScript==
// @name         ShopBack Cashback Export
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Export ShopBack cashback data to CSV
// @author       You
// @match        *://*.shopback.com.au/*
// @match        https://www.shopback.com.au/*
// @match        https://app.shopback.com.au/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shopback.com.au
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create export button
    function createExportButton() {
        console.log('Creating export button...');
        const button = document.createElement('button');
        button.textContent = 'Export Cashback to CSV';
        button.style.position = 'fixed';
        button.style.top = '80px'; // Positioned below the header
        button.style.right = '20px';
        button.style.zIndex = '2147483647'; // Maximum z-index value
        button.style.padding = '15px 20px';
        button.style.backgroundColor = '#ff0000';
        button.style.color = '#ffffff';
        button.style.border = 'none';
        button.style.borderRadius = '8px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        button.style.fontSize = '16px';
        button.style.transition = 'transform 0.2s ease';
        button.style.userSelect = 'none';
        button.style.pointerEvents = 'auto';

        // Add hover effect
        button.addEventListener('mouseover', () => {
            button.style.transform = 'scale(1.05)';
            button.style.backgroundColor = '#cc0000';
        });

        button.addEventListener('mouseout', () => {
            button.style.transform = 'scale(1)';
            button.style.backgroundColor = '#ff0000';
        });

        button.addEventListener('click', startExport);

        // Create a container with highest possible z-index
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '80px';
        container.style.right = '20px';
        container.style.zIndex = '2147483647';
        container.style.pointerEvents = 'none'; // Let clicks pass through the container
        container.appendChild(button);

        // Ensure the button stays visible
        const ensureButtonVisible = () => {
            if (!document.body.contains(container)) {
                document.body.appendChild(container);
            }
        };

        // Add the button and set up a periodic check to ensure it stays visible
        document.body.appendChild(container);
        setInterval(ensureButtonVisible, 1000);

        console.log('Export button created');
    }

    // Check if we're on the cashback page
    function isCashbackPage() {
        return window.location.href.includes('/cashback-summary') ||
            window.location.href.includes('/cashback');
    }

    // Wait for the table to be present in the DOM
    function waitForTable() {
        return new Promise((resolve) => {
            const checkTable = () => {
                const table = document.querySelector('table tbody');
                if (table) {
                    console.log('Table found');
                    resolve();
                } else {
                    console.log('Waiting for table...');
                    setTimeout(checkTable, 500);
                }
            };
            checkTable();
        });
    }

    // Initialize the script
    async function initialize() {
        console.log('Initializing script...');
        if (!isCashbackPage()) {
            console.log('Not on cashback page, script will not load');
            return;
        }

        console.log('Waiting for page to load...');
        await waitForTable();
        createExportButton();
    }

    // Format date according to specified format
    function formatDate(dayStr, timeStr, year) {
        const [day, month] = dayStr.split(' ');
        const [hours, minutes] = timeStr.split(':');
        return `${day.padStart(2, '0')}-${month}-${year} ${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    // Wait for a specified time
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Determine transaction type based on description and other factors
    function determineTransactionType(description, id) {
        if (description.includes('ShopBack Vouchers:')) {
            return 'Gift Card';
        }
        if (description.startsWith('Code used:')) {
            return 'Bonus';
        }
        if (description.includes('Referral')) {
            return 'Referral';
        }
        if (description.includes('Challenge')) {
            return 'Challenge';
        }
        if (id && (id.startsWith('AU_') || id.startsWith('Code used:'))) {
            return 'Bonus';
        }
        return 'Purchase'; // Default type for regular transactions
    }

    // Extract transaction ID from various formats
    function extractTransactionId(text) {
        if (!text) return '';

        // For ShopBack Vouchers
        if (text.startsWith('ShopBack Vouchers:')) {
            return text.split(':')[1].trim();
        }

        // For challenge bonus IDs (starting with AU_)
        if (text.startsWith('Code used: ')) {
            return text.replace('Code used: ', '').trim();
        }
        if (text.startsWith('AU_')) {
            return text.trim();
        }

        // For regular transaction IDs (alphanumeric with possible dashes)
        const idMatch = text.match(/(?:ID:\s*)?([a-zA-Z0-9_-]+)$/);
        if (idMatch) {
            return idMatch[1].trim();
        }

        return '';
    }

    // Try to find the hidden expanded row for a transaction row
    function findExpandedRow(row) {
        // Look for the next sibling that might be the expanded content
        let nextRow = row.nextElementSibling;
        if (nextRow && nextRow.querySelector('td[colspan="4"]')) {
            return nextRow;
        }

        // If not found, look for any hidden expanded content that might be associated
        const rowId = row.getAttribute('data-row-id') || '';
        if (rowId) {
            return document.querySelector(`tr[data-expanded-row="${rowId}"]`);
        }

        return null;
    }

    // Extract purchase amount from expanded content
    async function extractPurchaseAmount(row) {
        // First, try clicking the row to expand it
        try {
            row.click();
            await sleep(100); // Wait for expansion

            // Look for the expanded content
            const expandedContent = findExpandedRow(row);
            if (!expandedContent) return '';

            console.log('Expanded content found, searching for purchase amount...');

            // Try to find the purchase amount in different formats
            const divs = expandedContent.querySelectorAll('div');
            for (const div of divs) {
                const text = div.textContent.trim();

                // For voucher purchases
                if (text.includes('Purchase Amount:') || text.includes('Voucher Amount:')) {
                    console.log('Found purchase/voucher amount text:', text);
                    const spans = div.querySelectorAll('span');
                    const lastSpan = spans[spans.length - 1];
                    if (lastSpan && lastSpan.textContent) {
                        const amount = lastSpan.textContent.trim();
                        if (amount.startsWith('$')) {
                            console.log('Found amount:', amount);
                            row.click(); // Collapse
                            return amount;
                        }
                    }
                }
            }

            // Try multiple selectors to find the purchase amount
            const possibleSelectors = [
                'div[class*="flex_column"] span:last-child',
                'div[class*="details"] span:last-child',
                'div[class*="transaction-details"] span:last-child',
                'div[class*="voucher"] span:last-child',
                'div[class*="amount"] span:last-child'
            ];

            for (const selector of possibleSelectors) {
                const elements = expandedContent.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent.trim();
                    if (text.startsWith('$')) {
                        // Verify this is a purchase amount and not cashback amount
                        const parentText = element.parentElement.textContent.trim().toLowerCase();
                        if (parentText.includes('purchase') ||
                            parentText.includes('voucher') ||
                            parentText.includes('amount:')) {
                            console.log('Found amount via selector:', text);
                            row.click(); // Collapse
                            return text;
                        }
                    }
                }
            }

            // Click again to collapse (cleanup)
            row.click();
        } catch (error) {
            console.log('Error extracting purchase amount:', error);
            console.error(error);
        }

        return '';
    }

    // Extract ID from expanded content
    function extractIdFromExpanded(expandedContent) {
        if (!expandedContent) return '';

        // Look for ID in the expanded content
        const idDivs = Array.from(expandedContent.querySelectorAll('div'));
        for (const div of idDivs) {
            if (div.textContent && div.textContent.includes('ID:')) {
                const spans = div.querySelectorAll('span');
                const lastSpan = spans[spans.length - 1];
                if (lastSpan && lastSpan.textContent) {
                    return lastSpan.textContent.trim();
                }
            }
        }

        return '';
    }

    // Extract confirmation date from description text
    function extractConfirmationDate(text) {
        if (!text) return '';

        const match = text.match(/Confirmed by (\d{2} [A-Za-z]+ \d{4})/);
        if (match) {
            const [day, month, year] = match[1].split(' ');
            // Format as DD-MMM-YYYY HH:mm
            return `${day.padStart(2, '0')}-${month}-${year} 00:01`;
        }
        return '';
    }

    // Extract data from a transaction row
    async function extractRowData(row, currentYear) {
        // Check if this is a year row
        if (row.classList.contains('table-row-year')) {
            return { isYear: true, year: row.querySelector('p').textContent.trim() };
        }

        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return null;

        // Extract date and time
        const dateCell = cells[0].querySelector('div');
        const dayMonth = dateCell.querySelector('p').textContent.trim();
        const time = dateCell.querySelector('span').textContent.trim();
        const date = formatDate(dayMonth, time, currentYear);

        // Extract description (vendor)
        const descriptionDiv = cells[1].querySelector('div');
        const vendor = descriptionDiv.querySelector('p').textContent.trim();

        // Extract ID and confirmation date from description
        let id = '';
        let confirmationDate = '';
        const descriptionTexts = descriptionDiv.querySelectorAll('p');
        let descriptionForType = '';

        descriptionTexts.forEach((text, index) => {
            const textContent = text.textContent.trim();
            descriptionForType += textContent + ' ';

            if (index === 1) { // Second p element might contain ID
                const extractedId = extractTransactionId(textContent);
                if (extractedId) {
                    id = extractedId;
                }
            } else if (index === 2) { // Third p element might contain confirmation date
                confirmationDate = extractConfirmationDate(textContent);
            }
        });

        // If no ID found in description, try to get it from expanded content
        if (!id) {
            // Click to expand
            row.click();
            await sleep(100);
            const expandedContent = findExpandedRow(row);
            if (expandedContent) {
                id = extractIdFromExpanded(expandedContent) || '';
                // Click to collapse
                row.click();
            }
        }

        // Extract amount
        const amount = cells[2].querySelector('p').textContent.trim();

        // Extract status
        const statusChip = cells[3].querySelector('.MuiChip-label');
        const status = statusChip ? statusChip.textContent.trim() : '';

        // Extract purchase amount by expanding the row
        const purchase = await extractPurchaseAmount(row);

        // Determine transaction type
        const type = determineTransactionType(descriptionForType, id);

        return {
            isYear: false,
            id,
            date,
            confirmationDate,
            vendor,
            type,
            purchase,
            amount,
            status
        };
    }

    // Click next page button if available
    function clickNextPage() {
        const paginationButtons = Array.from(document.querySelectorAll('button'));
        const nextButton = paginationButtons.find(button =>
            button.textContent === 'Next page' ||
            button.getAttribute('aria-label') === 'Go to next page'
        );

        if (nextButton && !nextButton.disabled) {
            nextButton.click();
            return true;
        }
        return false;
    }

    // Process current page and collect data
    async function processCurrentPage(currentData = [], currentYear = new Date().getFullYear().toString()) {
        const rows = document.querySelectorAll('table tbody tr');
        for (const row of rows) {
            const rowData = await extractRowData(row, currentYear);
            if (!rowData) continue;

            if (rowData.isYear) {
                currentYear = rowData.year;
            } else {
                currentData.push(rowData);
            }

            // Add a small delay between processing rows
            await sleep(50);
        }

        return { data: currentData, year: currentYear };
    }

    // Export data to CSV
    function downloadCSV(data) {
        const headers = ['ID', 'Date', 'Confirmation Date', 'Vendor', 'Type', 'Purchase', 'Amount', 'Status'];
        let csvContent = headers.join(',') + '\n';

        data.forEach(row => {
            const values = [
                row.id,
                row.date,
                row.confirmationDate,
                `"${row.vendor.replace(/"/g, '""')}"`,
                row.type,
                row.purchase,
                row.amount,
                row.status
            ];
            csvContent += values.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'shopback_cashback.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Start the export process
    async function startExport() {
        let allData = [];
        let currentYear = new Date().getFullYear().toString();
        let hasNextPage = true;
        let pageCount = 0;
        const maxPages = 100; // Safety limit

        while (hasNextPage && pageCount < maxPages) {
            const { data, year } = await processCurrentPage(allData, currentYear);
            currentYear = year;
            allData = data;

            hasNextPage = clickNextPage();
            if (hasNextPage) {
                await sleep(1000); // Wait for page to load
                pageCount++;
            }
        }

        downloadCSV(allData);
    }

    // Initialize when the page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();