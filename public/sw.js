self.addEventListener('push', function (event) {
  let data = { title: 'JapanFlow', body: 'Nova notificação' };
  try {
    data = event.data.json();
  } catch (e) {
    // fallback
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'JapanFlow', {
      body: data.body || '',
      icon: '/logo_japanflow.png',
      badge: '/logo_japanflow.png',
      tag: data.tag || 'default-' + Date.now(),
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || '/');
      }
    })
  );
});
