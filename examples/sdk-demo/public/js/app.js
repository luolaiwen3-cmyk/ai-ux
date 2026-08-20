const PRODUCTS = [
  { id: 'longjing', name: '西湖明前龙井', category: 'tea', price: 128, unit: '80g', blurb: '扁平光滑，豆香清扬。适合作为首购观察对象。' },
  { id: 'lapsang', name: '正山小种', category: 'tea', price: 96, unit: '100g', blurb: '松烟香与桂圆底韵，适合对比筛选。' },
  { id: 'puer', name: '陈皮普洱', category: 'tea', price: 168, unit: '120g', blurb: '价格最高的茶，容易成为犹豫点。' },
  { id: 'beans', name: '云南水洗咖啡豆', category: 'coffee', price: 78, unit: '200g', blurb: '柑橘与红茶尾韵，中浅烘焙。' },
  { id: 'coldbrew', name: '冷萃咖啡液', category: 'coffee', price: 49, unit: '6瓶', blurb: '即饮规格，常被当作凑单商品。' },
  { id: 'honey', name: '桂花蜜', category: 'grocery', price: 58, unit: '250g', blurb: '放在茶器旁边时更容易被加购。' },
  { id: 'cup', name: '手作青釉杯', category: 'ware', price: 89, unit: '单只', blurb: '缩略图和标题不完全对应，用于观察确认成本。' },
  { id: 'bag', name: '亚麻购物袋', category: 'ware', price: 36, unit: '一只', blurb: '低价配件，结账页才强调运费门槛。' }
]

const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'tea', label: '茶叶' },
  { id: 'coffee', label: '咖啡' },
  { id: 'grocery', label: '食材' },
  { id: 'ware', label: '器物' }
]

const CART_KEY = 'harbor-market-cart'
const thumbClass = (category) => `thumb thumb-${category}`
let lastOrder = ''

const cart = {
  read() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] }
  },
  write(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
    renderChrome()
  },
  count() {
    return this.read().reduce((sum, item) => sum + item.qty, 0)
  },
  add(id, qty = 1) {
    const items = this.read()
    const found = items.find((item) => item.id === id)
    if (found) found.qty += qty
    else items.push({ id, qty })
    this.write(items)
  },
  setQty(id, qty) {
    const items = this.read().map((item) => item.id === id ? { ...item, qty } : item).filter((item) => item.qty > 0)
    this.write(items)
  }
}

function productById(id) {
  return PRODUCTS.find((item) => item.id === id)
}

function formatPrice(value) {
  return `¥${value.toFixed(0)}`
}

function productCard(product) {
  return `<article class="product">
    <a href="/product.html?id=${product.id}"><div class="${thumbClass(product.category)}"></div></a>
    <div class="product-body">
      <h3><a href="/product.html?id=${product.id}">${product.name}</a></h3>
      <p class="muted">${product.unit}</p>
      <div class="row spread">
        <span class="price">${formatPrice(product.price)}</span>
        <button class="btn" data-add="${product.id}" type="button">加入</button>
      </div>
    </div>
  </article>`
}

function renderChrome() {
  const header = document.querySelector('[data-app-header]')
  const footer = document.querySelector('[data-app-footer]')
  const page = document.body.dataset.page
  if (header) {
    header.innerHTML = `<header class="site-header"><div class="header-inner">
      <a class="brand" href="/"><span class="mark"></span>北港市集</a>
      <nav class="nav">
        <a href="/" ${page === 'home' ? 'aria-current="page"' : ''}>首页</a>
        <a href="/catalog.html" ${page === 'catalog' || page === 'product' ? 'aria-current="page"' : ''}>市集</a>
        <a href="/cart.html" ${page === 'cart' ? 'aria-current="page"' : ''}>结算</a>
      </nav>
      <form class="search" action="/catalog.html" method="get">
        <input name="q" placeholder="搜索龙井、咖啡或器物" value="${new URLSearchParams(location.search).get('q') || ''}" />
        <button type="submit">搜索</button>
      </form>
      <a class="cart-link" href="/cart.html">购物车<strong data-cart-count>${cart.count()}</strong></a>
    </div></header>`
  }
  if (footer) {
    footer.innerHTML = `<footer class="site-footer"><div class="footer-inner">北港市集 · InsightUX Recorder SDK 测试站 · 运费满 99 包邮</div></footer>`
  }
}

function filteredProducts() {
  const params = new URLSearchParams(location.search)
  const category = params.get('category') || 'all'
  const query = (params.get('q') || '').trim()
  const sort = params.get('sort') || 'featured'
  let list = PRODUCTS.filter((item) => category === 'all' || item.category === category)
  if (query) list = list.filter((item) => `${item.name}${item.blurb}`.includes(query))
  if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
  return { list, category, query, sort }
}

function renderHome() {
  const featured = PRODUCTS.filter((item) => ['longjing', 'beans', 'cup', 'honey'].includes(item.id))
  document.querySelector('[data-page-root]').innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Harbor Market</p>
        <h1>把时令茶叶和器物带回日常。</h1>
        <p>这是一个供 InsightUX 外部 URL 任务使用的多页商店。请搜索商品、对比价格，并把至少一件商品加入购物车后完成结算。</p>
        <div class="hero-actions">
          <a class="btn" href="/catalog.html">进入市集</a>
          <a class="btn btn-ghost" href="/catalog.html?category=tea">先看茶叶</a>
        </div>
      </div>
      <aside class="hero-aside">
        <p class="eyebrow">今日任务</p>
        <h2>买一款茶叶，并确认是否包邮。</h2>
        <p>首页主按钮和分类入口并不指向同一筛选结果，结算页优惠券入口也藏在折叠区。</p>
      </aside>
    </section>
    <h2>时令精选</h2>
    <div class="grid">${featured.map(productCard).join('')}</div>`
}

function renderCatalog() {
  const { list, category, query, sort } = filteredProducts()
  document.querySelector('[data-page-root]').innerHTML = `
    <div class="layout">
      <aside class="panel filters">
        <h2>筛选</h2>
        <div class="chip-row">
          ${CATEGORIES.map((item) => `<a class="chip ${item.id === category ? 'active' : ''}" href="/catalog.html?category=${item.id}${query ? `&q=${encodeURIComponent(query)}` : ''}">${item.label}</a>`).join('')}
        </div>
        <p class="muted">排序会保留关键词，但会丢掉部分筛选条件。</p>
        <label class="muted">排序<br>
          <select id="sort">
            <option value="featured" ${sort === 'featured' ? 'selected' : ''}>推荐</option>
            <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>价格从低到高</option>
            <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>价格从高到低</option>
          </select>
        </label>
      </aside>
      <section>
        <h1>${query ? `“${query}”的结果` : '全部在售'}</h1>
        <p class="muted">${list.length} 件商品</p>
        <div class="grid">${list.map(productCard).join('') || '<div class="empty">没有符合条件的商品，试试清空筛选。</div>'}</div>
      </section>
    </div>`
  document.querySelector('#sort').addEventListener('change', (event) => {
    const next = new URL('/catalog.html', location.origin)
    if (query) next.searchParams.set('q', query)
    next.searchParams.set('sort', event.target.value)
    location.href = `${next.pathname}${next.search}`
  })
}

function renderProduct() {
  const id = new URLSearchParams(location.search).get('id')
  const product = productById(id) || PRODUCTS[0]
  let qty = 1
  document.querySelector('[data-page-root]').innerHTML = `
    <section class="detail">
      <div class="${thumbClass(product.category)}"></div>
      <div class="panel">
        <p class="eyebrow">${CATEGORIES.find((item) => item.id === product.category)?.label}</p>
        <h1>${product.name}</h1>
        <p>${product.blurb}</p>
        <p class="price">${formatPrice(product.price)} / ${product.unit}</p>
        <div class="qty">
          <button type="button" data-qty="-1" aria-label="减少">−</button>
          <strong data-qty-value>1</strong>
          <button type="button" data-qty="1" aria-label="增加">+</button>
        </div>
        <div class="hero-actions">
          <button class="btn" data-add-detail type="button">加入购物车</button>
          <a class="btn btn-ghost" href="/cart.html">去结算</a>
        </div>
        <p class="muted">满 99 元包邮。会员免运费入口会在数秒后出现。</p>
      </div>
    </section>`
  document.querySelector('[data-page-root]').addEventListener('click', (event) => {
    if (event.target.dataset.qty) {
      qty = Math.max(1, qty + Number(event.target.dataset.qty))
      document.querySelector('[data-qty-value]').textContent = String(qty)
    }
    if (event.target.dataset.addDetail !== undefined) {
      cart.add(product.id, qty)
      event.target.textContent = '已加入'
    }
  })
  window.setTimeout(() => {
    const toast = document.createElement('aside')
    toast.className = 'toast'
    toast.innerHTML = `<strong>会员免运费</strong><p class="muted">开通会员可免去本单运费。也可以继续以访客身份结算。</p><button class="btn btn-accent" type="button" data-dismiss>知道了</button>`
    toast.querySelector('[data-dismiss]').onclick = () => toast.remove()
    document.body.append(toast)
  }, 2500)
}

function renderCart() {
  const items = cart.read().map((item) => ({ ...item, product: productById(item.id) })).filter((item) => item.product)
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  document.querySelector('[data-page-root]').innerHTML = `
    <div class="layout">
      <section class="panel">
        <h1>购物车</h1>
        ${lastOrder ? `<p class="notice">${lastOrder}</p>` : ''}
        ${items.length === 0 ? '<div class="empty">购物车是空的。<a href="/catalog.html">去市集看看</a></div>' : items.map((item) => `
          <div class="cart-item">
            <div class="${thumbClass(item.product.category)}"></div>
            <div>
              <strong>${item.product.name}</strong>
              <p class="muted">${formatPrice(item.product.price)} × ${item.qty}</p>
              <div class="qty">
                <button type="button" data-set="${item.id}" data-qty="${item.qty - 1}">−</button>
                <span>${item.qty}</span>
                <button type="button" data-set="${item.id}" data-qty="${item.qty + 1}">+</button>
              </div>
            </div>
            <div class="price">${formatPrice(item.product.price * item.qty)}</div>
          </div>`).join('')}
      </section>
      <aside class="panel">
        <h2>确认订单</h2>
        <p>商品合计 <strong class="price">${formatPrice(subtotal)}</strong></p>
        <p class="muted">${subtotal >= 99 ? '已满包邮门槛。' : `还差 ${formatPrice(99 - subtotal)} 包邮。`}</p>
        <form class="form-grid" id="checkout">
          <label>收件人<input name="name" required placeholder="张三" autocomplete="name"></label>
          <label>手机号<input name="phone" required placeholder="11 位手机号" inputmode="numeric" autocomplete="tel"></label>
          <label>地址<textarea name="address" required rows="3" placeholder="城市、街道和门牌"></textarea></label>
          <label>支付方式
            <select name="pay">
              <option value="online">在线支付</option>
              <option value="cod">货到付款</option>
            </select>
          </label>
          <details>
            <summary>更多优惠</summary>
            <label>优惠码<input name="coupon" placeholder="例如 HARBOR10" autocomplete="off"></label>
          </details>
          <button class="btn btn-accent" ${items.length ? '' : 'disabled'}>提交订单</button>
        </form>
      </aside>
    </div>`
}

function handleCheckout(event) {
  event.preventDefault()
  const items = cart.read().map((item) => ({ ...item, product: productById(item.id) })).filter((item) => item.product)
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  const data = Object.fromEntries(new FormData(event.target).entries())
  const discount = data.coupon?.trim().toUpperCase() === 'HARBOR10' ? Math.round(subtotal * 0.1) : 0
  lastOrder = `订单已提交。优惠 ${formatPrice(discount)}，实付 ${formatPrice(Math.max(0, subtotal - discount))}，支付方式 ${data.pay === 'cod' ? '货到付款' : '在线支付'}。`
  cart.write([])
  renderCart()
}

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]')
  if (add) cart.add(add.dataset.add)
  const setQty = event.target.closest('[data-set]')
  if (setQty) {
    cart.setQty(setQty.dataset.set, Number(setQty.dataset.qty))
    if (document.body.dataset.page === 'cart') renderCart()
  }
})

document.addEventListener('submit', (event) => {
  if (event.target.id === 'checkout') handleCheckout(event)
})

renderChrome()
const page = document.body.dataset.page
if (page === 'home') renderHome()
if (page === 'catalog') renderCatalog()
if (page === 'product') renderProduct()
if (page === 'cart') renderCart()
