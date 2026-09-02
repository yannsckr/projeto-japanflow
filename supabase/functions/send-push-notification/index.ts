import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importVapidPrivateKey(
  base64UrlPrivateKey: string,
  base64UrlPublicKey: string
): Promise<CryptoKey> {
  const privateKeyBytes = base64UrlToUint8Array(base64UrlPrivateKey);
  const publicKeyBytes = base64UrlToUint8Array(base64UrlPublicKey);

  // Ensure we have 32 bytes for private key and 65 bytes for public key
  if (privateKeyBytes.length !== 32) {
    throw new Error(`Invalid private key length: ${privateKeyBytes.length}, expected 32`);
  }

  // Convert raw keys to JWK format for reliable import
  const x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33)); // skip 0x04 prefix
  const y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));
  const d = uint8ArrayToBase64Url(privateKeyBytes);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d,
    ext: true,
  };

  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

async function createVapidJwt(
  audience: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ jwt: string; publicKeyB64: string }> {
  const encoder = new TextEncoder();

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: 'mailto:admin@japanflow.app',
  };

  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const vapidKey = await importVapidPrivateKey(vapidPrivateKey, vapidPublicKey);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    vapidKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;

  if (sigBytes[0] === 0x30) {
    // DER encoded - parse r and s
    const rLen = sigBytes[3];
    const rStart = 4;
    const rBytes = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    const sBytes = sigBytes.slice(sStart, sStart + sLen);

    let r = rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes;
    let s = sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes;
    if (r.length < 32) {
      const p = new Uint8Array(32);
      p.set(r, 32 - r.length);
      r = p;
    }
    if (s.length < 32) {
      const p = new Uint8Array(32);
      p.set(s, 32 - s.length);
      s = p;
    }
    rawSig = new Uint8Array([...r, ...s]);
  } else {
    rawSig = sigBytes.slice(0, 64);
  }

  const jwt = `${unsignedToken}.${uint8ArrayToBase64Url(rawSig)}`;
  const publicKeyB64 = uint8ArrayToBase64Url(base64UrlToUint8Array(vapidPublicKey));

  return { jwt, publicKeyB64 };
}

async function encryptPayload(
  payload: string,
  subscriberPublicKeyB64: string,
  subscriberAuthB64: string
): Promise<{ body: Uint8Array }> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const subscriberPublicKey = base64UrlToUint8Array(subscriberPublicKeyB64);
  const subscriberAuth = base64UrlToUint8Array(subscriberAuthB64);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    localKeyPair.privateKey,
    256
  );

  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

  // HKDF key derivation (RFC 8291)
  const authInfo = new Uint8Array([
    ...encoder.encode('WebPush: info\0'),
    ...subscriberPublicKey,
    ...localPublicKeyBytes,
  ]);

  // IKM = HKDF(salt=authSecret, ikm=sharedSecret, info=authInfo, len=32)
  const ikm = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, [
    'deriveBits',
  ]);

  // First derive PRK using auth secret as salt
  const authKeyMaterial = await crypto.subtle.importKey(
    'raw',
    subscriberAuth,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Use a two-step approach: first extract with auth, then expand
  // Step 1: HKDF-Extract(salt=auth, IKM=ecdh_secret) then HKDF-Expand(PRK, info=authInfo, L=32)
  const prkBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: subscriberAuth, info: authInfo },
    ikm,
    256
  );

  const prkKey = await crypto.subtle.importKey('raw', prkBits, { name: 'HKDF' }, false, [
    'deriveBits',
  ]);

  // CEK
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey,
    128
  );

  // Nonce
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey,
    96
  );

  // Encrypt
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter

  const encKey = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonceBits) },
    encKey,
    paddedPayload
  );

  const encryptedBytes = new Uint8Array(encrypted);

  // Build aes128gcm content coding header + ciphertext
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, encryptedBytes.length + 86, false);

  const body = new Uint8Array([
    ...salt, // 16 bytes
    ...recordSize, // 4 bytes
    localPublicKeyBytes.length, // 1 byte (65)
    ...localPublicKeyBytes, // 65 bytes
    ...encryptedBytes, // variable
  ]);

  return { body };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const audience = new URL(subscription.endpoint).origin;

  const { jwt, publicKeyB64 } = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);
  const { body } = await encryptPayload(payload, subscription.p256dh, subscription.auth);

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
    },
    body,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, title, body, tag } = await req.json();
    if (!userId || !title) {
      return new Response(JSON.stringify({ error: 'Missing userId or title' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    console.log(
      `Processing push for user ${userId}, pubkey len=${vapidPublicKey.length}, privkey len=${vapidPrivateKey.length}`
    );

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(JSON.stringify({ error: 'DB error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({ title, body: body || '', tag: tag || `notif-${Date.now()}` });
    let sent = 0;
    const expired: string[] = [];
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        const res = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        const responseText = await res.text();
        console.log(`Push to ${sub.endpoint.substring(0, 60)}... status=${res.status}`);

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          expired.push(sub.id);
        } else {
          console.error(`Push failed ${res.status}: ${responseText}`);
          errors.push(`${res.status}: ${responseText.substring(0, 100)}`);
        }
      } catch (e) {
        console.error('Push send error:', e);
        errors.push(String(e).substring(0, 100));
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length, expired: expired.length, errors }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
