export function renderTable(selector, rows, columns, formatters = {}) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;

    tbody.innerHTML = rows.map(row => `
        <tr class="border-b">
            ${columns.map(col => `<td class="p-3">${formatters[col] ? formatters[col](row[col], row) : (row[col] ?? "—")}</td>`).join('')}
        </tr>
    `).join('');
}
