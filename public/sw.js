self.addEventListener('push', function (event) {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || payload.title || 'JapanFlow';

  const body = notification.body || data.body || payload.body || 'Nova notificação';

  const url = data.url || payload.url || '/';

  const tag = data.tag || payload.tag || 'japanflow-' + Date.now();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo_japanflow.png',
      badge: '/logo_japanflow.png',
      tag,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i];

        if ('focus' in client) {
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl).then(function () {
              return client.focus();
            });
          }

          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
