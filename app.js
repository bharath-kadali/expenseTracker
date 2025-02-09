const API_KEY = 'd00d7d0608ea44c7b90ece72267c2d6e';

class CurrencyConverter {
    constructor() {
        this.cacheDuration = 3600000;
    }

    async getExchangeRates() {
        const cached = JSON.parse(localStorage.getItem('exchangeRates'));
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.rates;
        }

        try {
            const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${API_KEY}`);
            const data = await response.json();
            localStorage.setItem('exchangeRates', JSON.stringify({ rates: data.rates, timestamp: Date.now() }));
            return data.rates;
        } catch (error) {
            console.error('Failed to fetch rates:', error);
            return cached ? cached.rates : null;
        }
    }

    async convert(amount, from, to) {
        if (!amount || isNaN(amount)) return 0;
        if (from === to) return amount;
        
        try {
            const rates = await this.getExchangeRates();
            if (!rates || !rates[from] || !rates[to]) return amount;
            return (amount / rates[from]) * rates[to];
        } catch (error) {
            console.error('Conversion failed:', error);
            return amount;
        }
    }
}

class ExpenseManager {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.preferredCurrency = localStorage.getItem('preferredCurrency') || 'USD';
        this.converter = new CurrencyConverter();
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    async addExpense(expense) {
        expense.convertedAmount = await this.converter.convert(expense.amount, expense.currency, this.preferredCurrency);
        this.expenses.push(expense);
        this.saveExpenses();
    }

    async editExpense(id, updates) {
        const index = this.expenses.findIndex(e => e.id === id);
        if (index === -1) return;
        Object.assign(this.expenses[index], updates);
        this.expenses[index].convertedAmount = await this.converter.convert(
            this.expenses[index].amount,
            this.expenses[index].currency,
            this.preferredCurrency
        );
        this.saveExpenses();
    }

    deleteExpense(id) {
        this.expenses = this.expenses.filter(e => e.id !== id);
        this.saveExpenses();
    }

    setCurrency(currency) {
        this.preferredCurrency = currency;
        localStorage.setItem('preferredCurrency', currency);
    }
}

class ChartManager {
    constructor() {
        this.chart = null;
    }

    updateChart(expenses, currency) {
        if (typeof Chart === 'undefined') return;
        
        const ctx = document.getElementById('chart');
        if (!ctx) {
            console.error('Chart canvas not found');
            return;
        }

        if (this.chart) this.chart.destroy();

        const categories = [...new Set(expenses.map(e => e.category))];
        const totals = categories.map(cat => 
            expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.convertedAmount, 0)
        );

        this.chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    label: `Spending in ${currency}`,
                    data: totals,
                    backgroundColor: ['#5B8FB9', '#FF4F79', '#735CDD', '#F8C630', '#00C49A']

          

                }]
            }
        });
    }
}

class UI {
    constructor() {
        this.manager = new ExpenseManager();
        this.chartManager = new ChartManager();
        this.initialize();
    }

    initialize() {
        this.bindEvents();
        this.updateDisplay();
    }

    bindEvents() {
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('preferredCurrency').addEventListener('change', (e) => this.handleCurrencyChange(e));
        document.getElementById('expensesTable').addEventListener('click', (e) => this.handleTableClick(e));
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        if (!form.amount.value || !form.currency.value || !form.category.value || !form.date.value) {
            alert('Please fill in all fields');
            return;
        }

        const amount = parseFloat(form.amount.value);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        const expense = {
            id: Date.now().toString(),
            amount: amount,
            currency: form.currency.value,
            category: form.category.value,
            date: form.date.value
        };

        try {
            await this.manager.addExpense(expense);
            form.reset();
            this.updateDisplay();
        } catch (error) {
            console.error('Failed to add expense:', error);
            alert('Failed to add expense. Please try again.');
        }
    }

    async handleCurrencyChange(e) {
        this.manager.setCurrency(e.target.value);
        await this.updateDisplay();
    }

    handleTableClick(e) {
        if (e.target.classList.contains('delete-btn')) {
            this.manager.deleteExpense(e.target.dataset.id);
            this.updateDisplay();
        }
    }

    async updateDisplay() {
        for (let exp of this.manager.expenses) {
            exp.convertedAmount = await this.manager.converter.convert(exp.amount, exp.currency, this.manager.preferredCurrency);
        }
        this.manager.saveExpenses();

        // Update the table
        const tbody = document.querySelector('#expensesTable tbody');
        tbody.innerHTML = this.manager.expenses.map(exp => `
            <tr>
                <td>${exp.amount} ${exp.currency}</td>
                <td>${exp.convertedAmount.toFixed(2)} ${this.manager.preferredCurrency}</td>
                <td>${exp.category}</td>
                <td>${exp.date}</td>
                <td>
                    <button class="delete-btn" data-id="${exp.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Calculate and display the total amount spent
        const totalAmount = this.manager.expenses.reduce((sum, exp) => sum + exp.convertedAmount, 0);
        document.getElementById('totalAmount').textContent = totalAmount.toFixed(2);
        document.getElementById('totalCurrency').textContent = this.manager.preferredCurrency;

        // Update the chart
        this.chartManager.updateChart(this.manager.expenses, this.manager.preferredCurrency);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => new UI());