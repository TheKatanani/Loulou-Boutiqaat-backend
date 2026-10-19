const express = require('express');
const router = express.Router();
const db = require('../../models');

const parseImages = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      return [images];
    }
  }
  return [images];
};

const getCatalogProducts = async () => {
  if (!db.isConnected) {
    return db.mockData.mockProducts.filter(p => p.published !== false);
  }
  try {
    const Product = db.products;
    const prods = await Product.findAll({ where: { published: true } });
    return prods.map(p => {
      const data = p.dataValues ? { ...p.dataValues } : { ...p };
      data.images = parseImages(data.images);
      return data;
    });
  } catch (err) {
    console.error('Error fetching catalog products:', err);
    return db.mockData.mockProducts;
  }
};

const sanitizeCdata = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\]\]>/g, ']]&gt;');
};

const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// 1. Meta / Facebook / WhatsApp XML RSS Feed
router.get('/facebook-feed.xml', async (req, res) => {
  try {
    const products = await getCatalogProducts();
    const siteUrl = 'https://loulou-boutiqaat.vercel.app';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title><![CDATA[Loulou Boutiqaat - كتالوج لولو بوتيكات]]></title>
    <link>${escapeXml(siteUrl)}</link>
    <description><![CDATA[كتالوج متجر لولو بوتيكات للعطور الفاخرة ومستحضرات التجميل والأزياء الراقية]]></description>
`;

    products.forEach((p) => {
      const images = parseImages(p.images);
      const mainImg = images[0] || 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800';
      const cleanDesc = sanitizeCdata(p.description || p.name);
      const cleanTitle = sanitizeCdata(p.name);
      const priceNum = Number(p.price) || 0;
      const formattedPrice = `${priceNum.toFixed(2)} ILS`;
      const productLink = `${siteUrl}/home/products/${p.id}`;

      xml += `    <item>
      <g:id>${p.id}</g:id>
      <g:title><![CDATA[${cleanTitle}]]></g:title>
      <g:description><![CDATA[${cleanDesc}]]></g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(mainImg)}</g:image_link>
      <g:brand><![CDATA[Loulou Boutiqaat]]></g:brand>
      <g:condition>new</g:condition>
      <g:availability>in stock</g:availability>
      <g:price>${formattedPrice}</g:price>
      <g:inventory>50</g:inventory>
    </item>
`;
    });

    xml += `  </channel>
</rss>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Catalog XML Error:', error);
    return res.status(500).send('Error generating catalog feed');
  }
});

// 2. Meta CSV Catalog Feed (Easy 1-click upload or scheduled fetch)
router.get('/products.csv', async (req, res) => {
  try {
    const products = await getCatalogProducts();
    const siteUrl = 'https://loulou-boutiqaat.vercel.app';

    let csv = 'id,title,description,availability,condition,price,link,image_link,brand\n';

    products.forEach((p) => {
      const images = parseImages(p.images);
      const mainImg = images[0] || '';
      const safeTitle = `"${(p.name || '').replace(/"/g, '""')}"`;
      const safeDesc = `"${(p.description || '').replace(/"/g, '""')}"`;
      const link = `${siteUrl}/home/products/${p.id}`;
      const price = `${p.price} ILS`;

      csv += `${p.id},${safeTitle},${safeDesc},in stock,new,${price},${link},${mainImg},Loulou Boutiqaat\n`;
    });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('loulou_boutiqaat_catalog.csv');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Catalog CSV Error:', error);
    return res.status(500).send('Error generating catalog CSV');
  }
});

// 3. JSON summary with direct WhatsApp sharing URLs
router.get('/summary', async (req, res) => {
  try {
    const products = await getCatalogProducts();
    const siteUrl = 'https://loulou-boutiqaat.vercel.app';
    const waNumber = '972597229340';

    const items = products.map((p) => {
      const images = parseImages(p.images);
      const productUrl = `${siteUrl}/home/products/${p.id}`;
      const waText = encodeURIComponent(`مرحباً لولو بوتيكات، أرغب بطلب:\n*${p.name}*\nالسعر: ${p.price} ₪\nرابط المنتج: ${productUrl}`);
      const directWaLink = `https://wa.me/${waNumber}?text=${waText}`;

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        image: images[0] || null,
        url: productUrl,
        directOrderWhatsAppUrl: directWaLink
      };
    });

    return res.status(200).json({
      status: 'success',
      totalProducts: items.length,
      feeds: {
        xmlFeedUrl: 'https://loulou-boutiqaat-backend-a46b.onrender.com/catalog/facebook-feed.xml',
        csvDownloadUrl: 'https://loulou-boutiqaat-backend-a46b.onrender.com/catalog/products.csv'
      },
      products: items
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
