# Using Doze Tabs with Safari

<div align="center">
	<img src="https://i.imgur.com/wzYR5gz.png" alt="Doze Tabs x Safari">
</div><br><br>

I'm not paying Apple a hundred bucks a year for the privilege of publishing my free, open source extension in their App Store.

You can build your own version of Doze Tabs for Safari. Here's how you do it:

### Requirements
- **MacOS 10.14.6+**
- **Xcode 12+**
	- Including [Command Line Tools]((https://developer.apple.com/download/more/)) for Xcode
- **Safari 14+**
	- Show **Developer** menu in **Safari** > **Preferences** > **Advanced**
	- Allow [Unsigned Extensions](https://i.imgur.com/4l1piHd.png) in the **Develop** menu</details>


- **Doze Tabs for Safari** ([latest release](https://github.com/ghobs91/doze-tabs/releases/latest))
	- The `activeTab` permission is used in place of `tabs` to minimise [access requests](https://developer.apple.com/documentation/safariservices/safari_web_extensions/managing_safari_web_extension_permissions) to the user.
	- All unsupported WebExtension APIs are removed (`notifications`, `idle`, `commands`).

### Simple Installation

1. Extract the Snoozz-Safari-x.x.x.zip file, and open the containing folder in terminal
2. Run `./safari.sh`


### Advanced Installation

1. In Terminal, navigate into the downloaded (unzipped) `Doze Tabs for Safari` directory and [convert the extension]((https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari)) to an Xcode package using this command:
```
	xcrun safari-web-extension-converter . --app-name "snoozz_for_safari"  --bundle-identifier com.snoozeman.snoozz --swift --force --no-open
```

2. [Build and run](https://developer.apple.com/documentation/safariservices/safari_app_extensions/building_a_safari_app_extension#2957926) the xcodeproject.
```
	cd snoozz_for_safari
	xcodebuild -scheme snoozz_for_safari build
```

3. Open **Safari** > **Preferences** > **Extensions** and enable Snoozz.

4. Get through all the scary warning menus and then get snoozing.

### What's broken?
- **Snoozing windows:**
	This requires use of the `tabs` API. Using that API, you will see a privacy popup every single time you try to snooze a website you have not snoozed before. The popup explicitly states *Grant the extension permission to read all your data on this site* which is going to put off a lot of users.

- **Notifications:**
	Safari does not support the `notifications` API.
- **Keyboard Shortcuts:**
	Safari does not let you configure your own keyboard shortcuts.
- **Inconsistent wake up times:**
	Safari does not support the `idle` API. It is used to calculate the next tab to wake up after your computer comes back from standby. It's very likely that your tabs will not wake up until you interact with the extension in any way.
- **UI bugs:**
	This extension was designed for Chrome and Firefox, so things might look a teeny bit off.
    
Find anything else broken? Leave a [bug report](https://github.com/ghobs91/doze-tabs/issues/new/choose). It would be extremely helpful if you could [open up the logs](https://i.imgur.com/9xYn5Ll.png) and give me [an error code](https://i.imgur.com/B6YJjJD.png) (screenshot or copy/paste, either is fine)
