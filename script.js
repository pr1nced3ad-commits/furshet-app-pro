document.addEventListener('DOMContentLoaded', function () {
    // Безопасно инициализируем WebApp, чтобы код не "падал", если скрипт Telegram не загрузился
    const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

    // --- НАСТРОЙКИ ---
    //⚠️ ВСТАВЬТЕ СЮДА ВАШУ CSV-ССЫЛКУ ИЗ GOOGLE SHEETS
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9X0GUMusSveT9KojVe4g2EhG3C_MTsEzjfnEkDLyc0fhO56Z8ALs0jX1c-0ffuyXo2vkO1vdD8ank/pub?output=csv';
    const CURRENCY = '₽';

    // --- Глобальные переменные ---
    let menuData = [];
    const cart = {};
    const contentContainer = document.getElementById('content-container');
    const searchInput = document.getElementById('search-input');
    const floatingCartBtn = document.getElementById('floating-cart-btn');
    const modalOverlay = document.getElementById('cart-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const checkoutBtn = document.getElementById('checkout-btn');

    // --- ЗАГРУЗКА И ОБРАБОТКА ДАННЫХ ---
    async function loadMenu() {
        try {
            contentContainer.innerHTML = '<p style="text-align:center;">Загрузка меню...</p>';
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const csvText = await response.text();
            
            menuData = csvText.split('\n').slice(1).map(row => {
                const columns = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                // Теперь нам достаточно 5 обязательных колонок
                if (columns.length < 5) return null;
                const clean = columns.map(c => c.trim().replace(/^"|"$/g, ''));
                const item = {
                    id: clean[0], 
                    category: clean[1], 
                    name: clean[2],
                    price: parseFloat(clean[3]), 
                    category_image: clean[4],
                    // item_image_url теперь необязательный. Если 6-й колонки нет, будет пустая строка.
                    item_image_url: clean[5] || '' 
                };
                if (!item.id || !item.category || !item.name || isNaN(item.price) || !item.category_image) return null;
                return item;
            }).filter(Boolean);
            
            renderCategories();
            updateAllDisplays();
        } catch (error) {
            console.error('Failed to load menu:', error);
            contentContainer.innerHTML = '<p style="color:red;text-align:center;">Ошибка загрузки меню.</p>';
        }
    }

    // --- ФУНКЦИИ ОТОБРАЖЕНИЯ (РЕНДЕРИНГА) ---
    function renderCategories() {
        const categories = menuData.reduce((acc, item) => {
            if (item.category && !acc[item.category]) {
                acc[item.category] = item.category_image;
            }
            return acc;
        }, {});
        let html = '<div class="grid-container">';
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
    // --- ИЗМЕНЕНИЕ: Создаем контейнер для всего экрана товаров ---
    let html = '<div id="items-page-container">';
    
    html += `
        <div class="page-header">
            <button id="back-to-categories-btn" class="back-button">←</button>
            <h2>${title}</h2>
        </div>
        <div class="grid-container">`;
    items.forEach(item => {
        const quantity = cart[item.id] || 0;
        // ... (здесь весь ваш код для карточки товара, он остается без изменений) ...
        const imageUrl = item.item_image_url ? item.item_image_url : item.category_image;
        html += `
            <div class="item-card">
                <div class="item-image" style="background-image: url('${imageUrl}')"></div>
                <div class="item-info">
                    <p class="item-name">${item.name}</p>
                    <div class="item-controls" id="controls-${item.id}">`;
        if (quantity > 0) {
            html += `
                <div class="counter">
                    <button class="btn-minus" data-id="${item.id}">-</button>
                    <span>${quantity}</span>
                    <button class="btn-plus" data-id="${item.id}">+</button>
                </div>`;
        } else {
            html += `<button class="btn-plus-item" data-id="${item.id}">${item.price} ${CURRENCY}</button>`;
        }
        html += `</div></div></div>`;
    });
    html += '</div></div>'; // Закрываем grid-container и items-page-container
    showContent(html);
}

    function showContent(html) {
        contentContainer.innerHTML = html;
        attachEventListeners();
    }
    
    // --- ЛОГИКА КОРЗИНЫ И ОБНОВЛЕНИЯ ---
    function addToCart(id) {
        cart[id] = (cart[id] || 0) + 1;
        updateAllDisplays();
    }
    function removeFromCart(id) {
        if (cart[id]) {
            cart[id]--;
            if (cart[id] <= 0) delete cart[id];
            updateAllDisplays();
        }
    }
    
    function updateAllDisplays() {
        // Обновляем счетчики на карточках товаров
        menuData.forEach(item => {
            const controlsDiv = document.getElementById(`controls-${item.id}`);
            if (!controlsDiv) return;
            const quantity = cart[item.id] || 0;
            if (quantity > 0) {
                if (!controlsDiv.querySelector('.counter')) {
                    controlsDiv.innerHTML = `
                        <div class="counter">
                            <button class="btn-minus" data-id="${item.id}">-</button>
                            <span>${quantity}</span>
                            <button class="btn-plus" data-id="${item.id}">+</button>
                        </div>`;
                } else {
                    controlsDiv.querySelector('span').innerText = quantity;
                }
            } else {
                controlsDiv.innerHTML = `<button class="btn-plus-item" data-id="${item.id}">${item.price} ${CURRENCY}</button>`;
            }
        });

        // Обновляем модальное окно корзины
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
            const imageUrl = item.item_image_url ? item.item_image_url : item.category_image;
            const li = document.createElement('div');
            li.className = 'cart-item-card';
            li.innerHTML = `
                <div class="item-image" style="background-image: url('${imageUrl}')"></div>
                <div class="item-info"><p>${item.name}</p></div>
                <div class="item-controls">
                    <button class="btn-minus" data-id="${item.id}">-</button>
                    <span>${quantity}</span>
                    <button class="btn-plus" data-id="${item.id}">+</button>
                </div>`;
            cartItemsList.appendChild(li);
        });

        if (totalItems === 0) {
            cartItemsList.innerHTML = '<p id="empty-cart-message">Ваша корзина пуста</p>';
        }

        cartTotalPriceEl.innerText = `${totalPrice} ${CURRENCY}`;
        document.getElementById('floating-cart-text').innerText = `Корзина (${totalItems})`;
        
        floatingCartBtn.style.display = 'flex';


        if (webApp) {
            if (totalItems > 0) {
                webApp.MainButton.setText("Оформить заказ");
                webApp.MainButton.enable();
                webApp.MainButton.show();
            } else {
                webApp.MainButton.disable();
                webApp.MainButton.hide();
            }
        }

        checkoutBtn.style.display = totalItems > 0 ? 'block' : 'none';
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    function attachEventListeners() {
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                const items = menuData.filter(item => item.category === category);
                renderItems(items, category);
            });
        });
        const backBtn = document.getElementById('back-to-categories-btn');
        if (backBtn) backBtn.addEventListener('click', renderCategories);
    }
    
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
    
    document.body.addEventListener('click', e => {
        const plus = e.target.closest('.btn-plus, .btn-plus-item');
        const minus = e.target.closest('.btn-minus');
        if (plus) addToCart(plus.dataset.id);
        if (minus) removeFromCart(minus.dataset.id);
    });

    floatingCartBtn.addEventListener('click', () => modalOverlay.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });

    // --- ОТПРАВКА ЗАКАЗА ---
    function handleCheckout() {
        const totalItems = Object.keys(cart).reduce((sum, id) => sum + cart[id], 0);
        if (totalItems === 0) {
            const message = "Ваша корзина пуста.";
            if (webApp) webApp.showAlert(message); else alert(message);
            return;
        }

        const orderData = { cart: {}, totalPrice: 0, userInfo: webApp ? webApp.initDataUnsafe.user : {} };
        let total = 0;
        Object.keys(cart).forEach(id => {
            const item = menuData.find(m => m.id === id);
            if (item) {
                orderData.cart[item.name] = { quantity: cart[id], price: item.price };
                total += item.price * cart[id];
            }
        });
        orderData.totalPrice = total;
        
        if (webApp && webApp.sendData) {
            webApp.sendData(JSON.stringify(orderData));
        } else {
            console.log("Эмуляция отправки заказа:", orderData);
            alert("Заказ отправлен (эмуляция)!\n" + JSON.stringify(orderData, null, 2));
        }
    }
    
    checkoutBtn.addEventListener('click', handleCheckout);
    if (webApp) {
        webApp.onEvent('mainButtonClicked', handleCheckout);
        checkoutBtn.style.display = 'none';
    }

    // --- ИНИЦИАЛИЗАЦИЯ ---
    if(webApp) {
        webApp.expand();
    }
    loadMenu();
    updateAllDisplays();

});

