import { supabase } from './supabase';

function getResourceType(file) {
  if (file?.type?.startsWith('video/')) return 'video';
  if (file?.type?.startsWith('image/')) return 'image';
  throw new Error('Only image and video uploads are supported.');
}

/**
 * Upload media directly from the browser to Cloudinary using a short-lived
 * server-generated signature. Cloudinary API secrets never reach the browser.
 *
 * Returns both publicId and immutable assetId so either can be stored in Supabase.
 */
export async function uploadMediaToCloudinary(file, { purpose = 'content' } = {}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!file) throw new Error('Choose an image or video first.');

  const resourceType = getResourceType(file);
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) throw new Error('Sign in before uploading media.');

  const signatureResponse = await fetch('/api/cloudinary-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ resourceType, purpose }),
  });

  const signatureData = await signatureResponse.json();
  if (!signatureResponse.ok) {
    throw new Error(signatureData.error || 'Could not authorize Cloudinary upload.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', String(signatureData.timestamp));
  formData.append('folder', signatureData.folder);
  formData.append('signature', signatureData.signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${resourceType}/upload`,
    { method: 'POST', body: formData },
  );

  const upload = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(upload.error?.message || 'Cloudinary upload failed.');
  }

  return {
    url: upload.secure_url,
    publicId: upload.public_id,
    assetId: upload.asset_id,
    resourceType: upload.resource_type,
    format: upload.format,
    bytes: upload.bytes,
    width: upload.width ?? null,
    height: upload.height ?? null,
    duration: upload.duration ?? null,
  };
}
