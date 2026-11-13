# native-demo

An Expo app for trying React Theme Tide in React Native. It uses the library's built files in `../dist`, so build the library first.

```bash
npm run build                # in the repository root
cd native-demo
npm install
npx expo start --go
```

Open it in Expo Go on a phone or an emulator. On an Android emulator you can forward the port and open it directly:

```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081 host.exp.exponent
```

Metro doesn't notice a rebuild of `../dist`, so restart it after `npm run build`.

The versions match Expo SDK 57. If your Expo Go is for another SDK, change them with `npx expo install --fix`.
