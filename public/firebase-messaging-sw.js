/* Firebase Cloud Messaging service worker. Config arrives in the registration URL. */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

try {
  const config = JSON.parse(new URL(self.location.href).searchParams.get('config') || '{}')
  if (config.apiKey) {
    firebase.initializeApp(config)
    const messaging = firebase.messaging()
    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification || {}
      self.registration.showNotification(n.title || 'DollScene', {
        body: n.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: payload.data || {},
      })
    })
  }
} catch (e) {
  console.warn('FCM service worker not configured', e)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/messages'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.navigate(link).then(() => c.focus())
      return clients.openWindow(link)
    }),
  )
})
