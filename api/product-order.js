import { cleanText, getAuthenticatedUser, getServerSupabase, safeJsonBody, sendSmtpMail, validEmail } from '../server/_server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = safeJsonBody(req);
    if (body.company_website) return res.status(200).json({ ok: true });
    const productId = cleanText(body.product_id, 80);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 200).toLowerCase();
    const message = cleanText(body.message, 1500) || null;
    if (!productId || !name || !validEmail(email)) {
      return res.status(400).json({ error: 'Please provide your name and a valid email.' });
    }

    const supabase = getServerSupabase();
    const { data: product, error: productError } = await supabase
      .from('digital_products')
      .select('id,name,price,currency,status')
      .eq('id', productId)
      .eq('status', 'active')
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: 'Product is not available.' });

    const user = await getAuthenticatedUser(req);
    const { data: order, error } = await supabase
      .from('digital_product_orders')
      .insert({
        product_id: product.id,
        user_id: user?.id || null,
        name,
        email,
        amount: product.price,
        currency: product.currency,
        message,
      })
      .select('id')
      .single();
    if (error) throw error;

    const notify = process.env.SALES_NOTIFY_EMAIL || process.env.SMTP_TO || process.env.SMTP_FROM;
    if (notify) {
      sendSmtpMail({
        to: notify,
        subject: `New KM Afaq product order: ${product.name}`,
        text: `${name} (${email}) requested ${product.name} for ${product.currency} ${product.price}.\n\n${message || ''}`,
        html: `<h2>New digital product order</h2><p><strong>${name}</strong> (${email}) requested <strong>${product.name}</strong>.</p><p>Price: ${product.currency} ${product.price}</p><p>${message || ''}</p>`,
      }).catch((mailError) => console.error('Product order notification email failed:', mailError));
    }

    return res.status(201).json({ ok: true, order_id: order.id });
  } catch (error) {
    console.error('Product order error:', error);
    return res.status(500).json({ error: 'Could not submit your order.' });
  }
}
