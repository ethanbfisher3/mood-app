note: I would build with EAS CLI if you can, it's much simpler. If you don't have EAS CLI or it's not working, then use the other option

# Building for iOS with EAS CLI

1. **Login to Expo**

   ```sh
   npx expo login
   ```

2. **Install EAS CLI (if not already installed)**

   ```sh
   npm install -g eas-cli
   ```

3. **Build for iOS**

   ```sh
   eas build -p ios --profile production
   ```

   - Use `--profile development` for a development build.

4. **Apple Developer Account**
   - You need an Apple Developer account to build for iOS.
   - EAS CLI will guide you through credentials setup if needed.

5. **Download the .ipa**
   - After the build completes, download the .ipa file from the Expo dashboard or the CLI link.
   - Use this file for TestFlight or App Store submission.

## Building for iOS Without EAS CLI

If you do not want to use EAS CLI, you must use the **bare workflow** (not managed Expo):

1. **Eject to Bare Workflow**

   ```sh
   npx expo eject
   ```

   This creates the `ios/` and `android/` folders.

2. **Open the Project in Xcode**
   - Open the `ios/` folder in Xcode.
   - Let Xcode install dependencies and finish indexing.

3. **Build and Run**
   - Select your device or simulator.
   - Click the Run button or use `Cmd + R` to build and launch.

4. **Archive for App Store/TestFlight**
   - In Xcode, go to `Product > Archive`.
   - Use the Organizer to upload your build to App Store Connect.

**Note:**

- You must have a Mac with Xcode installed.
- You need an Apple Developer account.
- This method is only available for bare React Native projects (not managed Expo).

For more info: [React Native iOS Guide](https://reactnative.dev/docs/running-on-device)

---
