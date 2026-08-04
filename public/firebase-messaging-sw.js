importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyCm6A3ecdnRuM2BtqcU8hbViNVmtSYowNE",
    authDomain: "crm-notification-system-b1fbf.firebaseapp.com",
    projectId: "crm-notification-system-b1fbf",
    storageBucket: "crm-notification-system-b1fbf.firebasestorage.app",
    messagingSenderId: "822813005343",
    appId: "1:822813005343:web:9b60be7829ac4a5615e72a"
});


const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/logo.png",
    });
});