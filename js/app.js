/**
 * Goldabook Pro — Интерактивная платформа премиального книжного клуба
 * Production Commercial Platform
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeSwitcher();
  initBookmarks();
  initLiveCatalogFilter();
  initQuoteCopier();
  initOrderCalculator();
  initBackToTop();
  initBookDetailsModal();
});

/* ==========================================================================
   1. Переключение тем оформления (Dark / Light Mode) с сохранением
   ========================================================================== */
function initThemeSwitcher() {
  const THEME_KEY = 'goldabook-theme';
  const savedTheme = localStorage.getItem(THEME_KEY);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  applyTheme(initialTheme);

  // Автоматическая реакция на переключение системной темы ОС (если не задано вручную)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Обработчик клика на кнопки переключения темы
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.classList.add('theme-animating');
      const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem(THEME_KEY, newTheme);
      showToast('Тема оформления', `Включена ${newTheme === 'dark' ? 'тёмная' : 'светлая'} тема`, 'info');
      setTimeout(() => {
        document.body.classList.remove('theme-animating');
      }, 300);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему');
    btn.setAttribute('title', theme === 'dark' ? 'Светлая тема' : 'Тёмная тема');
  });

  // Динамическое обновление цвета статус-бара мобильных браузеров
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', theme === 'dark' ? '#090d16' : '#f8fafc');
}

/* ==========================================================================
   2. Избранное и Список чтения (Bookmarks)
   ========================================================================== */
const BOOKMARKS_KEY = 'goldabook-bookmarks';

function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveBookmarks(list) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  updateBookmarksBadge();
}

function updateBookmarksBadge() {
  const list = getBookmarks();
  document.querySelectorAll('.bookmarks-badge').forEach(badge => {
    badge.textContent = list.length;
    badge.style.display = list.length > 0 ? 'inline-block' : 'none';
  });

  // Обновляем состояние кнопок закладок на странице
  document.querySelectorAll('.btn-bookmark').forEach(btn => {
    const bookId = btn.getAttribute('data-book-id');
    const isSaved = list.some(item => item.id === bookId);
    if (isSaved) {
      btn.classList.add('active');
      btn.setAttribute('title', 'Удалить из списка чтения');
      btn.innerHTML = '★';
    } else {
      btn.classList.remove('active');
      btn.setAttribute('title', 'В список чтения');
      btn.innerHTML = '☆';
    }
  });
}

function initBookmarks() {
  updateBookmarksBadge();

  // Делегирование клика по кнопкам закладок
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-bookmark');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const bookId = btn.getAttribute('data-book-id');
    const title = btn.getAttribute('data-book-title') || 'Книга';
    let list = getBookmarks();
    const existingIndex = list.findIndex(item => item.id === bookId);

    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
      saveBookmarks(list);
      showToast('Список чтения', `«${title}» удалена из вашего списка чтения`, 'warning');
    } else {
      list.push({ id: bookId, title: title, date: new Date().toISOString() });
      saveBookmarks(list);
      showToast('Список чтения', `«${title}» добавлена в список чтения!`, 'success');
    }
  });

  // Клик по бейджу в шапке
  document.querySelectorAll('.bookmarks-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const list = getBookmarks();
      if (list.length === 0) {
        showToast('Список чтения пуст', 'Нажмите звёздочку на любой книге в каталоге, чтобы сохранить её.', 'info');
      } else {
        const bookTitles = list.map(b => `• ${b.title}`).join('\n');
        alert(`Ваш список чтения Goldabook (${list.length}):\n\n${bookTitles}\n\nВы можете записаться на обсуждение любой из этих книг в разделе "Встречи и запись".`);
      }
    });
  });
}

/* ==========================================================================
   3. Живой поиск, фильтрация и полноценная пагинация (catalog.html)
   ========================================================================== */
function initLiveCatalogFilter() {
  const searchInput = document.getElementById('catalog-search');
  const genreSelect = document.getElementById('filter-genre');
  const sortSelect = document.getElementById('filter-sort');
  const catalogGrid = document.getElementById('catalog-grid') || document.querySelector('.row.g-4');
  const countDisplay = document.querySelector('.catalog-count-display');
  const paginationNav = document.getElementById('catalog-pagination-nav');
  const paginationList = document.getElementById('catalog-pagination');

  if (!catalogGrid) return;

  const bookItems = Array.from(catalogGrid.querySelectorAll('.book-item-col'));
  if (bookItems.length === 0) return;

  const ITEMS_PER_PAGE = 3;
  let currentPage = 1;

  function render() {
    const query = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
    const selectedGenre = genreSelect ? genreSelect.value : 'all';
    const sortBy = sortSelect ? sortSelect.value : 'rating-desc';

    // 1. Фильтрация
    const filtered = bookItems.filter(col => {
      const title = (col.getAttribute('data-title') || '').toLowerCase();
      const author = (col.getAttribute('data-author') || '').toLowerCase();
      const genre = col.getAttribute('data-genre') || '';

      const matchesSearch = !query || title.includes(query) || author.includes(query);
      const matchesGenre = selectedGenre === 'all' || genre === selectedGenre;

      return matchesSearch && matchesGenre;
    });

    // 2. Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'rating-desc') {
        return parseFloat(b.getAttribute('data-rating') || 0) - parseFloat(a.getAttribute('data-rating') || 0);
      }
      if (sortBy === 'title-asc') {
        return (a.getAttribute('data-title') || '').localeCompare(b.getAttribute('data-title') || '');
      }
      if (sortBy === 'author-asc') {
        return (a.getAttribute('data-author') || '').localeCompare(b.getAttribute('data-author') || '');
      }
      return 0;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) {
      currentPage = 1;
    }

    // 3. Отображение элементов текущей страницы
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = filtered.slice(startIndex, endIndex);

    // Скрываем все книги
    bookItems.forEach(item => {
      item.style.display = 'none';
    });

    // Показываем только книги текущей страницы и упорядочиваем их в DOM
    currentItems.forEach(item => {
      item.style.display = '';
      catalogGrid.appendChild(item);
    });

    // 4. Обновляем счетчик
    if (countDisplay) {
      if (filtered.length === 0) {
        countDisplay.textContent = 'Книги не найдены';
      } else {
        countDisplay.innerHTML = `Показано <strong>${currentItems.length}</strong> из <strong>${filtered.length}</strong> шедевров (Страница <strong>${currentPage}</strong> из <strong>${totalPages}</strong>)`;
      }
    }

    // 5. Обработка пустого состояния
    let emptyBlock = document.getElementById('catalog-empty-state');
    if (filtered.length === 0) {
      if (!emptyBlock) {
        emptyBlock = document.createElement('div');
        emptyBlock.id = 'catalog-empty-state';
        emptyBlock.className = 'col-12 text-center py-5';
        emptyBlock.innerHTML = `
          <div class="p-4 bg-white rounded-3 shadow-sm border">
            <span class="fs-1 d-block mb-3">🔍</span>
            <h3 class="h5 fw-bold mb-2">Ничего не найдено</h3>
            <p class="text-muted small mb-3">По вашему запросу книги не найдены. Попробуйте изменить параметры поиска или жанр.</p>
            <button type="button" class="btn btn-gold btn-sm px-4" id="reset-filters-btn">Сбросить фильтры</button>
          </div>
        `;
        catalogGrid.appendChild(emptyBlock);
        document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          if (genreSelect) genreSelect.value = 'all';
          currentPage = 1;
          render();
        });
      }
      emptyBlock.style.display = 'block';
    } else if (emptyBlock) {
      emptyBlock.style.display = 'none';
    }

    // 6. Построение кнопок пагинации
    renderPagination(totalPages, filtered.length);
  }

  function renderPagination(totalPages, totalItems) {
    if (!paginationList || !paginationNav) return;

    if (totalItems <= ITEMS_PER_PAGE) {
      paginationNav.style.display = 'none';
      return;
    }

    paginationNav.style.display = '';
    paginationList.innerHTML = '';

    // Кнопка «Назад»
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<button class="page-link" type="button" aria-label="Предыдущая страница">&laquo; Назад</button>`;
    if (currentPage > 1) {
      prevLi.querySelector('button').addEventListener('click', () => {
        currentPage--;
        render();
        scrollToCatalog();
      });
    }
    paginationList.appendChild(prevLi);

    // Номера страниц (1, 2, 3...)
    for (let i = 1; i <= totalPages; i++) {
      const pageLi = document.createElement('li');
      pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
      pageLi.innerHTML = `<button class="page-link" type="button" aria-label="Страница ${i}">${i}</button>`;
      
      const pageBtn = pageLi.querySelector('button');
      if (i === currentPage) {
        pageLi.setAttribute('aria-current', 'page');
      } else {
        pageBtn.addEventListener('click', () => {
          currentPage = i;
          render();
          scrollToCatalog();
        });
      }
      paginationList.appendChild(pageLi);
    }

    // Кнопка «Вперёд»
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<button class="page-link" type="button" aria-label="Следующая страница">Вперёд &raquo;</button>`;
    if (currentPage < totalPages) {
      nextLi.querySelector('button').addEventListener('click', () => {
        currentPage++;
        render();
        scrollToCatalog();
      });
    }
    paginationList.appendChild(nextLi);
  }

  function scrollToCatalog() {
    const target = document.getElementById('catalog-search') || catalogGrid;
    if (target) {
      const y = target.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  // Привязка слушателей поиска и фильтров
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      render();
    });
  }
  if (genreSelect) {
    genreSelect.addEventListener('change', () => {
      currentPage = 1;
      render();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      render();
    });
  }

  const searchForm = searchInput ? searchInput.closest('form') : null;
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentPage = 1;
      render();
    });
  }

  // Проверка URL параметров (например ?genre=classic)
  const urlParams = new URLSearchParams(window.location.search);
  const genreParam = urlParams.get('genre');
  if (genreParam && genreSelect) {
    genreSelect.value = genreParam;
  }

  // Первоначальный рендер
  render();
}

/* ==========================================================================
   4. Копирование литературных цитат (product.html)
   ========================================================================== */
function initQuoteCopier() {
  document.querySelectorAll('.quote-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const quoteBlock = btn.closest('.quote-card') || btn.closest('blockquote');
      const text = quoteBlock ? quoteBlock.querySelector('.quote-text')?.textContent || quoteBlock.textContent : '';

      if (text) {
        navigator.clipboard.writeText(text.trim()).then(() => {
          const originalText = btn.innerHTML;
          btn.innerHTML = '✓ Скопировано!';
          btn.classList.replace('btn-outline-secondary', 'btn-success');
          showToast('Цитата скопирована', 'Текст цитаты успешно скопирован в буфер обмена.', 'success');

          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('btn-success', 'btn-outline-secondary');
          }, 2000);
        });
      }
    });
  });
}

/* ==========================================================================
   5. Калькулятор стоимости и генератор билета на встречу (order.html)
   ========================================================================== */
function initOrderCalculator() {
  const form = document.getElementById('clubRegistrationForm');
  if (!form) return;

  const guestsSelect = document.getElementById('order-guests');
  const eventSelect = document.getElementById('order-event');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('order-name')?.value || 'Гость клуба';
    const email = document.getElementById('order-email')?.value || '';
    const eventName = eventSelect?.options[eventSelect.selectedIndex]?.text || 'Встреча клуба';
    const guests = guestsSelect?.value || '1';

    const ticketNumber = 'GB-2026-' + Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toLocaleDateString('ru-RU');

    showTicketModal({
      ticketNumber,
      name,
      email,
      eventName,
      guests,
      dateStr
    });

    form.reset();
  });
}

function showTicketModal(data) {
  let modalEl = document.getElementById('ticketSuccessModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'ticketSuccessModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border-0">
          <div class="modal-header bg-dark text-white">
            <h5 class="modal-title">🎉 Заявка подтверждена!</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Закрыть"></button>
          </div>
          <div class="modal-body p-4">
            <div class="ticket-card mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge bg-warning text-dark fw-bold">КЛУБНЫЙ БИЛЕТ</span>
                <span class="small text-muted">${data.dateStr}</span>
              </div>
              <h4 class="h5 fw-bold mb-1">${data.eventName}</h4>
              <p class="mb-2 text-muted small">Участник: <strong>${data.name}</strong> (${data.guests} чел.)</p>
              <div class="pt-2 border-top d-flex justify-content-between align-items-center">
                <span class="ticket-barcode">||| | |||| | |||</span>
                <span class="badge bg-dark">${data.ticketNumber}</span>
              </div>
            </div>
            <p class="small text-muted mb-0">
              Копия билета и материалы к дискуссии отправлены на <strong>${data.email}</strong>. 
              Ждём вас на встрече!
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-gold btn-sm px-4" data-bs-dismiss="modal">Отлично</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  const ticketContent = modalEl.querySelector('.ticket-card');
  if (ticketContent) {
    ticketContent.querySelector('h4').textContent = data.eventName;
    ticketContent.querySelector('strong').textContent = data.name;
    ticketContent.querySelector('.badge.bg-dark').textContent = data.ticketNumber;
  }

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

/* ==========================================================================
   6. Кнопка «Наверх» с плавным скроллом
   ========================================================================== */
function initBackToTop() {
  let btn = document.querySelector('.back-to-top-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'back-to-top-btn';
    btn.setAttribute('aria-label', 'Вернуться наверх страницы');
    btn.setAttribute('title', 'Наверх');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ==========================================================================
   7. Всплывающие уведомления (Bootstrap Toast)
   ========================================================================== */
function showToast(title, message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1090';
    document.body.appendChild(container);
  }

  const toastId = 'toast-' + Date.now();
  const icon = type === 'success' ? '✓' : type === 'warning' ? '★' : 'ℹ️';
  const headerBg = type === 'success' ? 'text-success' : type === 'warning' ? 'text-warning' : 'text-primary';

  const toastEl = document.createElement('div');
  toastEl.id = toastId;
  toastEl.className = 'toast shadow-lg border-0';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="toast-header bg-dark text-white">
      <span class="me-2 ${headerBg} fw-bold">${icon}</span>
      <strong class="me-auto text-white">${title}</strong>
      <small class="text-secondary">только что</small>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Закрыть"></button>
    </div>
    <div class="toast-body bg-white text-dark">
      ${message}
    </div>
  `;

  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();

  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}


const bookDatabase = {
  'master': {
    title: 'Мастер и Маргарита',
    author: 'Михаил Афанасьевич Булгаков',
    genre: 'Классика XX века',
    rating: '★★★★★ 4.95',
    image: 'images/book-master.jpg',
    badge: 'Книга месяца (Ноябрь 2026)',
    desc: 'Вершина отечественной прозы XX столетия. Загадочный роман, сочетающий в себе евангельскую историю Понтия Пилата, колкую сатиру на советскую Москву 1930-х годов, трагическую любовь Мастера и пронзительную верность Маргариты.'
  },
  '1984': {
    title: '1984',
    author: 'Джордж Оруэлл',
    genre: 'Антиутопия',
    rating: '★★★★★ 4.88',
    image: 'images/book-1984.jpg',
    badge: 'Хит дискуссий',
    desc: 'Легендарный роман-антиутопия о тоталитарном государстве Океании, двоемыслии, Министерстве Правды и бунте маленького человека против всепоглощающей Системы.'
  },
  'dune': {
    title: 'Дюна',
    author: 'Фрэнк Герберт',
    genre: 'Научная фантастика',
    rating: '★★★★★ 4.91',
    image: 'images/book-dune.jpg',
    badge: 'Выбор клуба',
    desc: 'Монументальная фантастическая сага о пустынной планете Арракис, спайсе, песчаных червях, политических интригах Великих Домов и становлении Пола Атрейдеса Муад`Дибом.'
  },
  'solitude': {
    title: 'Сто лет одиночества',
    author: 'Габриэль Гарсиа Маркес',
    genre: 'Магический реализм',
    rating: '★★★★★ 4.84',
    image: 'images/book-solitude.jpg',
    badge: 'Золотая коллекция',
    desc: 'Культовая хроника рода Буэндиа в затерянном среди джунглей городке Макондо, где чудеса переплетаются с обыденностью, а одиночество передаётся через поколения.'
  },
  'flowers': {
    title: 'Цветы для Элджернона',
    author: 'Дэниел Киз',
    genre: 'Психологическая драма',
    rating: '★★★★★ 4.93',
    image: 'images/book-flowers.jpg',
    badge: 'Выбор читателей',
    desc: 'Пронзительная история умственно отсталого Чарли Гордона и лабораторного мышонка Элджернона, прошедших через революционный научный эксперимент по увеличению интеллекта.'
  },
  'prince': {
    title: 'Маленький принц',
    author: 'Антуан де Сент-Экзюпери',
    genre: 'Философская сказка',
    rating: '★★★★★ 4.97',
    image: 'images/book-prince.jpg',
    badge: 'Абсолютный фаворит',
    desc: 'Трогательная и глубокая философская притча о дружбе, любви, верности своей розе и умении видеть мир сердцем, а не только глазами.'
  },
  'bradbury': {
    title: '451° по Фаренгейту',
    author: 'Рэй Брэдбери',
    genre: 'Антиутопия',
    rating: '★★★★★ 4.89',
    image: 'images/book-bradbury.jpg',
    badge: 'Классика фантастики',
    desc: 'Тревожное предостережение о потребительском обществе будущего, где книги запрещены законом, а пожарные бригады сжигают любые найденные печатные страницы.'
  },
  'dostoevsky': {
    title: 'Преступление и наказание',
    author: 'Фёдор Михайлович Достоевский',
    genre: 'Русская классика',
    rating: '★★★★★ 4.94',
    image: 'images/book-dostoevsky.jpg',
    badge: 'Золотой фонд',
    desc: 'Бессмертное психологическое исследование греха, совести и искупления через судьбу Родиона Раскольникова в душном и тревожном Петербурге.'
  },
  'wilde': {
    title: 'Портрет Дориана Грея',
    author: 'Оскар Уайльд',
    genre: 'Интеллектуальная проза',
    rating: '★★★★★ 4.87',
    image: 'images/book-wilde.jpg',
    badge: 'Эстетизм и драма',
    desc: 'Блистательный роман об искушении вечной молодостью, гедонизме и страшной цене, которую приходится платить за утрату собственной души.'
  }
};

/* ==========================================================================
   8. Интерактивная карточка книги в модальном окне (#bookDetailsModal)
   ========================================================================== */
function initBookDetailsModal() {
  const modalEl = document.getElementById('bookDetailsModal');
  if (!modalEl) return;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.btn-open-book-modal') || e.target.closest('[data-bs-target="#bookDetailsModal"]');
    if (!trigger) return;

    let bookId = trigger.getAttribute('data-book-id');
    if (!bookId) {
      const parentCol = trigger.closest('.book-item-col') || trigger.closest('.card');
      const bmBtn = parentCol ? parentCol.querySelector('.btn-bookmark') : null;
      if (bmBtn) bookId = bmBtn.getAttribute('data-book-id');
    }

    if (!bookId || !bookDatabase[bookId]) {
      bookId = 'master';
    }

    const book = bookDatabase[bookId];

    const modalTitleEl = document.getElementById('bookDetailsModalLabel');
    if (modalTitleEl) modalTitleEl.textContent = `${book.title} — ${book.author}`;

    const imgEl = document.getElementById('modal-book-img');
    if (imgEl) {
      imgEl.src = book.image;
      imgEl.alt = `Обложка: ${book.title}`;
    }

    const badge1 = document.getElementById('modal-book-badge1');
    if (badge1) badge1.textContent = book.badge;

    const genreBadge = document.getElementById('modal-book-genre');
    if (genreBadge) genreBadge.textContent = book.genre;

    const titleEl = document.getElementById('modal-book-title');
    if (titleEl) titleEl.textContent = book.title;

    const authorEl = document.getElementById('modal-book-author');
    if (authorEl) authorEl.textContent = book.author;

    const specAuthor = document.getElementById('modal-spec-author');
    if (specAuthor) specAuthor.textContent = book.author;

    const specGenre = document.getElementById('modal-spec-genre');
    if (specGenre) specGenre.textContent = book.genre;

    const ratingEl = document.getElementById('modal-book-rating');
    if (ratingEl) ratingEl.textContent = book.rating;

    const descEl = document.getElementById('modal-book-desc');
    if (descEl) descEl.textContent = book.desc;

    const modalBmBtn = modalEl.querySelector('.modal-bookmark-toggle');
    if (modalBmBtn) {
      modalBmBtn.setAttribute('data-book-id', bookId);
      modalBmBtn.setAttribute('data-book-title', book.title);
      const isBookmarked = getBookmarks().includes(bookId);
      modalBmBtn.textContent = isBookmarked ? '★ В списке чтения (Сохранено)' : '☆ В список чтения';
      modalBmBtn.classList.toggle('btn-warning', isBookmarked);
      modalBmBtn.classList.toggle('btn-outline-dark', !isBookmarked);
    }
  });

  const modalBmBtn = modalEl.querySelector('.modal-bookmark-toggle');
  if (modalBmBtn) {
    modalBmBtn.addEventListener('click', function() {
      const bookId = this.getAttribute('data-book-id');
      const bookTitle = this.getAttribute('data-book-title');
      if (!bookId) return;

      const added = toggleBookmark(bookId, bookTitle);
      this.textContent = added ? '★ В списке чтения (Сохранено)' : '☆ В список чтения';
      this.classList.toggle('btn-warning', added);
      this.classList.toggle('btn-outline-dark', !added);

      const pageBtn = document.querySelector(`.btn-bookmark[data-book-id="${bookId}"]`);
      if (pageBtn) {
        pageBtn.textContent = added ? '★' : '☆';
        pageBtn.classList.toggle('active', added);
      }
    });
  }
}
