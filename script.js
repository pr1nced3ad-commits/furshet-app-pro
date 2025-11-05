document.addEventListener('DOMContentLoaded', function () {
    // Безопасно инициализируем WebApp
    const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

    // --- НАСТРОЙКИ ---
    // ⚠️ ВСТАВЬТЕ СЮДА ВАШУ CSV-ССЫЛКУ ИЗ GOOGLE SHEETS
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9X0GUMusSveT9KojVe4g2EhG3C_MTsEzjfnEkDLyc0fhO56Z8ALs0jX1c-0ffuyXo2vkO1vdD8ank/pub?gid=0&single=true&output=csv';
    const CURRENCY = '₽';

    // --- Глобальные переменные ---
    let menuData = []; // Единый массив для всех блюд
    const cart = {}; // Корзина
    const contentContainer = document.getElementById('content-container');
    
    // --- Элементы UI ---
    const searchInput = document.getElementById('search-input');
    const floatingCartBtn = document.getElementById('floating-cart-btn');
    const modalOverlay = document.getElementById('cart-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // --- ФУНКЦИЯ ЗАГРУЗКИ МЕНЮ ---
    async function loadMenu() {
        try {
            contentContainer.innerHTML = '<p style="text-align:center;">Загрузка меню...</p>';
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const csvText = await response.text();
            const rows = csvText.split('\n').slice(1);
            menuData = rows.map(row => {
                const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                if (columns.length < 5) return null;
                const clean = columns.map(c => c.trim().replace(/^"|"$/g, ''));
                const item = {
                    id: clean[0], 
                    category: clean[1], 
                    name: clean[2],
                    price: parseFloat(clean[3]), 
                    image_url: clean[4]
                };
                // Пропускаем строки с некорректными данными
                if (!item.id || !item.category || !item.name || isNaN(item.price) || !item.image_url) return null;
                return item;
            }).filter(Boolean); // Убираем все null (некорректные строки)
            
            renderCategories();
        } catch (error) {
            console.error('Failed to load menu:', error);
            contentContainer.innerHTML = '<p style="color:red;text-align:center;">Ошибка загрузки меню.</p>';
        }
    }

    // --- ФУНКЦИИ ОТОБРАЖЕНИЯ (РЕНДЕРИНГА) ---
    function renderCategories() {
        const categories = menuData.reduce((acc, item) => {
            if (!acc[item.category]) {
                acc[item.category] = item.image_url;
            }
            return acc;
        }, {});

        let html = '<div id="category-grid">';
        for (const cat in categories) {
            html += `
                <div class="category-card" data-category="${cat}">
                    <div class="image-container" style="background-image: url('${categories[cat]}')"></div>
                    <div class="title-overlay"><p>${cat}</p></div>
                </div>`;
        }
        html += '</div>';
        showContent(html);
    }

    function renderItems(items, title) {
        let html = `
            <div class="page-header">
                <button id="back-to-categories-btn">←</button>
                <h2>${title}</h2>
            </div>
            <ul class="items-list">`;
        items.forEach(item => {
            html += `
                <li class="menu-item">
                    <div class="item-info">
                        <p>${item.name}</p>
                        <p class="item-price">${item.price} ${CURRENCY}</p>
                    </div>
                    <div class="item-controls">
                        <button class="btn-minus" data-id="${item.id}">-</button>
                        <span id="quantity-${item.id}">${cart[item.id] || 0}</span>
                        <button class="btn-plus" data-id="${item.id}">+</button>
                    </div>
                </li>`;
        });
        html += '</ul>';
        showContent(html);
    }

    function showContent(html) {
        contentContainer.innerHTML = html;
        attachEventListeners();
    }

    function updateCartView() {
        const cartItemsList = document.getElementById('cart-items-list');
        const cartTotalPriceEl = document.getElementById('cart-total-price');
        cartItemsList.innerHTML = '';
        let totalItems = 0;
        let totalPrice = 0;

        Object.keys(cart).forEach(id => {
            const item = menuData.find(m => m.id === id);
            const quantity = cart[id];
            if (!item || quantity <= 0) return;
            totalItems += quantity;
            totalPrice += item.price * quantity;
            const li = document.createElement('li');
            li.className = 'menu-item';
            li.innerHTML = `
                <div class="item-info">
                    <p>${item.name}</p>
                </div>
                <div class="item-controls">
                    <button class="btn-minus" data-id="${item.id}">-</button>
                    <span>${quantity}</span>
                    <button class="btn-plus" data-id="${item.id}">+</button>
                </div>`;
            cartItemsList.appendChild(li);
        });

        if (totalItems === 0) {
            cartItemsList.innerHTML = '<p id="empty-cart-message">Корзина пуста</p>';
        }

        cartTotalPriceEl.innerText = `${totalPrice} ${CURRENCY}`;
        document.getElementById('floating-cart-text').innerText = `Корзина (${totalItems})`;

        if (totalItems > 0) {
            floatingCartBtn.classList.add('visible');
            floatingCartBtn.classList.remove('hidden');
            if(webApp) {
                webApp.MainButton.setText(`Оформить заказ (${totalPrice} ${CURRENCY})`);
                webApp.MainButton.show();
            }
        } else {
            floatingCartBtn.classList.add('hidden');
            floatingCartBtn.classList.remove('visible');
            if(webApp) webApp.MainButton.hide();
        }
    }
    
    // --- ЛОГИКА КОРЗИНЫ ---
    function addToCart(id) {
        cart[id] = (cart[id] || 0) + 1;
        updateItemQuantity(id);
        updateCartView();
    }
    function removeFromCart(id) {
        if (cart[id]) {
            cart[id]--;
            if (cart[id] <= 0) delete cart[id];
            updateItemQuantity(id);
            updateCartView();
        }
    }
    function updateItemQuantity(id) {
        const el = document.getElementById(`quantity-${id}`);
        if (el) el.innerText = cart[id] || 0;
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    function attachEventListeners() {
        // Клик по карточке категории
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                const items = menuData.filter(item => item.category === category);
                renderItems(items, category);
            });
        });

        // Кнопка "назад"
        const backBtn = document.getElementById('back-to-categories-btn');
        if (backBtn) backBtn.addEventListener('click', renderCategories);
    }
    
    // Поиск
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length > 1) {
            const results = menuData.filter(item => 
                item.name.toLowerCase().includes(query) || 
                item.category.toLowerCase().includes(query)
            );
            renderItems(results, 'Результаты поиска');
        } else if (query.length === 0) {
            renderCategories();
        }
    });
    
    // Делегирование кликов для кнопок +/- (на всем документе)
    document.body.addEventListener('click', e => {
        const plus = e.target.closest('.btn-plus');
        const minus = e.target.closest('.btn-minus');
        if (plus) addToCart(plus.dataset.id);
        if (minus) removeFromCart(minus.dataset.id);
    });

    // Открытие и закрытие модального окна корзины
    floatingCartBtn.addEventListener('click', () => modalOverlay.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });

    // --- ОТПРАВКА ЗАКАЗА ---
    if (webApp) {
        webApp.onEvent('mainButtonClicked', function () {
            const orderData = { cart: {}, totalPrice: 0, userInfo: webApp.initDataUnsafe.user };
            let total = 0;
            Object.keys(cart).forEach(id => {
                const item = menuData.find(m => m.id === id);
                if (item) {
                    orderData.cart[item.name] = { quantity: cart[id], price: item.price };
                    total += item.price * cart[id];
                }
            });
            orderData.totalPrice = total;
            webApp.sendData(JSON.stringify(orderData));
        });
    }

    // --- ИНИЦИАЛИЗАЦИЯ ---
    if(webApp) webApp.expand();
    loadMenu();
});