/* =========================================================
   ПОРТФОЛИО ВИДЕОМОНТАЖЁРА — ЛОГИКА
   - Загрузка videos.json через fetch()
   - Рендер карточек
   - Модальное окно с iframe
   - Защита контактов от спама
   ========================================================= */

/* ---------- ДЕФОЛТНЫЕ ВИДЕО (если videos.json недоступен) ---------- */
const DEFAULT_VIDEOS = [
  {
    id: 1,
    title: "Музыкальный клип | Dream Avenue",
    description: "Динамичный монтаж, цветокоррекция, VFX эффекты",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    thumbnail: "",
    platform: "youtube"
  },
  {
    id: 2,
    title: "Рекламный ролик | Бренд XYZ",
    description: "Motion дизайн, 2D анимация, синхронизация с музыкой",
    url: "https://www.youtube.com/embed/9bZkp7q19f0",
    thumbnail: "",
    platform: "youtube"
  },
  {
    id: 3,
    title: "Документальный фильм | Городские истории",
    description: "Эмоциональный монтаж, работа со звуком, интершум",
    url: "https://player.vimeo.com/video/76979871",
    thumbnail: "",
    platform: "vimeo"
  }
];

// ---------- VK-ЗАГЛУШКА (логотип VK) ----------
const VK_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
  '<rect width="100%" height="100%" fill="#0077FF"/>' +
  '<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="120" ' +
  'font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">VK</text>' +
  '</svg>'
);

/* ---------- DOM-ЭЛЕМЕНТЫ ---------- */
const videoGrid     = document.getElementById('videoGrid');
const carouselTrack = document.getElementById('carouselTrack');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const gridLoader    = document.getElementById('gridLoader');
const refreshBtn    = document.getElementById('refreshBtn');
const modal         = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose    = document.getElementById('modalClose');
const modalIframeWrap = document.getElementById('modalIframeWrap');
const modalTitle    = document.getElementById('modalTitle');
const modalDesc     = document.getElementById('modalDesc');
const videoLoader   = document.getElementById('videoLoader');
const carouselEl    = document.querySelector('.carousel');

let videos = [];
let currentIndex = 0;
let autoplayInterval = null;
const AUTOPLAY_DELAY = 4000; // 4 секунды между слайдами

/* =========================================================
   1. ЗАГРУЗКА ДАННЫХ ИЗ videos.json
   ========================================================= */
async function loadVideos() {
  showGridLoader(true);
  videoGrid.innerHTML = '';

  try {
    // Добавляем метку времени, чтобы избежать кеширования при обновлении
    const response = await fetch('videos.json?_=' + Date.now());
    if (!response.ok) throw new Error('Файл не найден');

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Пустой список');

    videos = data;
  } catch (err) {
    // Если JSON недоступен (например, открыто без сервера) — используем дефолтные
    console.warn('Не удалось загрузить videos.json:', err.message, '— показываю дефолтные примеры.');
    videos = DEFAULT_VIDEOS;
  } finally {
    currentIndex = 0;
    renderVideos(videos);
    buildCarousel();
    updateCarousel();
    // Повторное центрирование после загрузки превью (важно для мобильных!)
    setTimeout(updateCarousel, 100);
    setTimeout(updateCarousel, 300);
    setTimeout(updateCarousel, 700);
    startAutoplay();
    showGridLoader(false);
  }
}

/* =========================================================
   2. ГЕНЕРАЦИЯ КАРТОЧЕК
   ========================================================= */
function renderVideos(videos) {
  videoGrid.innerHTML = '';

  if (!videos.length) {
    videoGrid.innerHTML = '<p class="grid-message">Работы пока не добавлены.</p>';
    return;
  }

  videos.forEach((video, index) => {
    const card = document.createElement('article');
    card.className = 'video-card';

    // Превью: либо указанный thumbnail, либо автогенерация из YouTube
    const thumb = getThumbnail(video);
    // Бейдж платформы
    const badge = video.platform ? video.platform.toUpperCase() : 'VIDEO';

    card.innerHTML = `
      <div class="video-card__thumb">
        <span class="video-card__badge">${badge}</span>
        <img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy"
             onerror="this.style.display='none'">
        <div class="video-card__play"><i class="fa-solid fa-play"></i></div>
      </div>
      <div class="video-card__body">
        <h3 class="video-card__title">${escapeHtml(video.title)}</h3>
        <p class="video-card__desc">${escapeHtml(video.description)}</p>
        <button class="video-card__btn"><i class="fa-solid fa-play"></i> Смотреть</button>
      </div>
    `;

    // Клик по всей карточке и по кнопке — открывает модалку
    card.addEventListener('click', () => openModal(video));

    videoGrid.appendChild(card);

    // Stagger-анимация: каждая карточка появляется с задержкой
    setTimeout(() => card.classList.add('show'), index * 100);
  });
}

/* =========================================================
   КАРУСЕЛЬ-СПИСОК ВИДЕО В ХЕДЕРЕ
   ========================================================= */
function buildCarousel() {
  if (!carouselTrack) return;
  carouselTrack.innerHTML = '';

  videos.forEach((video, idx) => {
    const card = document.createElement('div');
    card.className = 'carousel-card';
    card.dataset.index = idx;
    card.innerHTML = `
      <img src="${getThumbnail(video)}" alt="${escapeHtml(video.title)}" loading="lazy" onerror="this.style.display='none'">
      <div class="card-title">${escapeHtml(video.title)}</div>
    `;

    // 🔧 Пересчёт позиции после загрузки картинки (фикс смещения)
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', updateCarousel);
      img.addEventListener('error', updateCarousel);
    }

    card.addEventListener('click', () => {
      if (idx === currentIndex) {
        openModal(video);
      } else {
        currentIndex = idx;
        updateCarousel();
        startAutoplay();
      }
    });

    carouselTrack.appendChild(card);
  });
}

function updateCarousel() {
  if (!carouselTrack || !carouselEl) return;

  const cards = carouselTrack.querySelectorAll('.carousel-card');
  if (!cards.length) return;

  cards.forEach((card, idx) => {
    card.classList.toggle('active', idx === currentIndex);
  });

  const activeCard = cards[currentIndex];
  if (!activeCard) return;

  const wrapper = carouselTrack.parentElement;

  if (activeCard.offsetWidth === 0 || wrapper.offsetWidth === 0) {
    requestAnimationFrame(updateCarousel);
    return;
  }

  const wrapperCenter = wrapper.clientWidth / 2;
  const cardCenter = activeCard.offsetLeft + activeCard.offsetWidth / 2;
  const offset = wrapperCenter - cardCenter;

  carouselTrack.style.transform = `translateX(${offset}px)`;
}
function nextSlide() {
  if (videos.length === 0) return;
  currentIndex = (currentIndex + 1) % videos.length;
  updateCarousel();
}

function prevSlide() {
  if (videos.length === 0) return;
  currentIndex = (currentIndex - 1 + videos.length) % videos.length;
  updateCarousel();
}

if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoplay(); });
if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoplay(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { nextSlide(); startAutoplay(); }
  if (e.key === 'ArrowLeft')  { prevSlide(); startAutoplay(); }
});

// Пересчёт позиции при ресайзе (с защитой от частых вызовов)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateCarousel, 150);
});

/* ===== СВАЙПЫ НА ТЕЛЕФОНЕ ===== */
let touchStartX = 0;
let touchEndX = 0;

if (carouselEl) {
  carouselEl.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoplay();
  }, { passive: true });

  carouselEl.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {     // порог свайпа
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    setTimeout(startAutoplay, 3000);
  }, { passive: true });
}

// ===== АВТОПРОКРУТКА =====
function startAutoplay() {
  stopAutoplay();
  autoplayInterval = setInterval(() => {
    nextSlide();
  }, AUTOPLAY_DELAY);
}

function stopAutoplay() {
  if (autoplayInterval) {
    clearInterval(autoplayInterval);
    autoplayInterval = null;
  }
}

if (carouselEl) {
  carouselEl.addEventListener('mouseenter', stopAutoplay);
  carouselEl.addEventListener('mouseleave', startAutoplay);
}

/* Получить превью видео */
function getThumbnail(video) {
  // 🔵 VK — ВСЕГДА логотип VK (обложек у VK нет)
  if (video.platform === 'vk') {
    return VK_PLACEHOLDER;
  }

  // Если задан явный thumbnail — используем его
  if (video.thumbnail && video.thumbnail.trim() !== '') return video.thumbnail;

  // Автогенерация превью для YouTube
  if (video.platform === 'youtube') {
    const id = extractYouTubeId(video.url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // Vimeo и прочее — тёмная заглушка
  return 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#111"/></svg>');
}

/* Извлечь ID видео YouTube из embed-ссылки */
function extractYouTubeId(url) {
  const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/* =========================================================
   3. МОДАЛЬНОЕ ОКНО
   ========================================================= */
function openModal(video) {
  stopAutoplay();

  // Заголовок и описание
  modalTitle.textContent = video.title;
  modalDesc.textContent = video.description;

  // Показываем лоадер видео
  videoLoader.style.display = 'flex';
  modalIframeWrap.innerHTML = '';

  // Формируем итоговый URL с нужными параметрами
  const src = buildEmbedUrl(video);

  // Создаём iframe
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.frameBorder = '0';

  // sandbox НЕ ставим для YouTube и VK — они в нём не работают
  if (video.platform !== 'vk' && video.platform !== 'youtube') {
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-presentation');
  }

  // Когда iframe загрузился — прячем лоадер
  iframe.addEventListener('load', () => { videoLoader.style.display = 'none'; });

  modalIframeWrap.appendChild(iframe);


  // Открываем модалку
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // блокируем прокрутку фона
}

/* Сборка URL с параметрами под платформу */
function buildEmbedUrl(video) {
  let url = video.url;
  // Разделитель: если в ссылке уже есть "?" — добавляем "&", иначе "?"
  const sep = url.includes('?') ? '&' : '?';

  if (video.platform === 'youtube') {
    // YouTube: убираем рекламу, без автовоспроизведения
    url += sep + 'rel=0&modestbranding=1&controls=1&showinfo=0&autoplay=0';
  } else if (video.platform === 'vimeo') {
    // Vimeo: приватность, без лишней информации
    url += sep + 'dnt=1&title=0&byline=0&portrait=0&autoplay=0';
  } else if (video.platform === 'vk') {
    // VK: без автозапуска (hd=2 — качество по умолчанию)
    url += sep + 'hd=2&autoplay=0';
  }

  return url;
}

/* Закрытие модалки */
function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modalIframeWrap.innerHTML = ''; // удаляем iframe -> останавливаем видео
  document.body.style.overflow = ''; // возвращаем прокрутку
  startAutoplay();
}

/* Закрытие: крестик, фон, ESC */
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

/* =========================================================
   4. КНОПКА "ОБНОВИТЬ ЛЕНТУ"
   ========================================================= */
refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('loading');
  loadVideos().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('loading'), 500);
  });
});

/* =========================================================
   5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================= */
function showGridLoader(show) {
  gridLoader.style.display = show ? 'flex' : 'none';
}

/* Экранирование HTML (защита от поломки разметки) */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================
   6. ЗАЩИТА КОНТАКТОВ ОТ СПАМА (подстановка через JS)
   ========================================================= */
function setupContacts() {
  // ⚙️ ИЗМЕНИ ЗДЕСЬ свои контакты:
  const tgUser = 'betaraw';            // ник в Telegram без @
  const mailUser = 'bz.jura';          // часть до @
  const mailDomain = 'gmail.com';          // домен

  const tgBtn = document.getElementById('tgBtn');
  const mailBtn = document.getElementById('mailBtn');

  // Собираем ссылки динамически — боты не считают их из HTML
  tgBtn.href = 'https://t.me/' + tgUser;
  mailBtn.href = 'mailto:' + mailUser + '@' + mailDomain;
}

/* =========================================================
   7. ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  loadVideos();        // загружаем видео
  setupContacts();     // подставляем контакты
  // Год в футере
  document.getElementById('year').textContent = new Date().getFullYear();
});