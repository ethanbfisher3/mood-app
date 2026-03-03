# Welcome to your Expo app

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Building

upgrade EAS CLI with:
npm install -g eas-cli
eas login

### Android Build

npx eas build --platform android --profile production

### iOS Build

npx eas build --platform ios --profile production

## In-App Purchase (Pro Upgrade)

This app uses `react-native-iap` for a non-consumable product:

- Product ID: `pro_upgrade`
- Type: Non-consumable

### Important

- IAP does **not** work in Expo Go.
- Use an EAS build (development/preview/production) for purchase testing.
- In development, a dev-only **Mock IAP Mode** toggle is available in the Upgrade modal to test upgrade UI flows in Expo Go.

### EAS build command (required)

```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

### iOS sandbox testing (brief)

1. Create `pro_upgrade` in App Store Connect.
2. Use a physical iOS device with a TestFlight or development EAS build.
3. Sign out of App Store personal account for purchases and use a Sandbox tester account when prompted.
4. Attempt purchase from Upgrade modal and verify Pro unlock + restore.

### Android internal testing (brief)

1. Create `pro_upgrade` in Google Play Console as a managed product.
2. Upload an Android App Bundle to an Internal testing track.
3. Add tester Gmail accounts to internal test list and license testing.
4. Install app from Play internal track and verify purchase + restore.

### Debug checklist

- Product ID is exactly `pro_upgrade` on both stores.
- App bundle identifier/package name matches store listing.
- Product is in Ready/Active status.
- Testing account is properly configured (Sandbox / Internal tester).
- You are using an EAS build, not Expo Go.
- Restore button finds previous purchases after reinstall.
- Transaction finishes/acknowledges successfully (no repeated pending purchase).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
