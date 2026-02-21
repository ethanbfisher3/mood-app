# Building for Android with EAS CLI

1. **Login to Expo**

   ```sh
   npx expo login
   ```

2. **Install EAS CLI (if not already installed)**

   ```sh
   npm install -g eas-cli
   ```

3. **Build for Android**

   ```sh
   eas build -p android --profile production
   ```

   - Use `--profile development` for a development build.

4. **Download the .aab**
   - After the build completes, download the `.aab` file from the Expo dashboard or the CLI link.
   - Use this file for Google Play Store submission.

## Building for Android Without EAS CLI

If you do not want to use EAS CLI, you must use the **bare workflow** (not managed Expo):

1. **Eject to Bare Workflow**

   ```sh
   npx expo eject
   ```

   This creates the `android/` and `ios/` folders.

2. **Open the Project in Android Studio**
   - Open the `android/` folder in Android Studio.
   - Let Android Studio sync and install dependencies.

3. **Build and Run**
   - Select your device or emulator.
   - Click the Run button or use `Shift + F10` to build and launch.

4. **Build an App Bundle (.aab)**
   - In Android Studio, go to `Build > Build Bundle(s) / APK(s) > Build Bundle`.
   - Find the `.aab` file in `android/app/build/outputs/bundle/release/`.
   - Upload this file to the Google Play Console.

**Note:**

- You must have Android Studio and JDK installed.
- This method is only available for bare React Native projects (not managed Expo).

For more info: [React Native Android Guide](https://reactnative.dev/docs/running-on-device)

---
