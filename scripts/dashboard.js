const TIME_GROUPS = ['Today', 'Tomorrow', 'This Week', 'Next Week', 'Later', 'History'];
var HISTORY = -1, CACHED_TABS;
async function init() {
	document.querySelector('.settings').addEventListener('click', _ => openExtensionTab('/html/settings.html'), {once:true})
	showIconOnScroll();
	setupClock();

	// refresh dashboard when storage changed if page is not in focus
	chrome.storage.onChanged.addListener(async changes => {
		if (!changes.snoozed || document.hasFocus()) return;
		var tabs = await getTabsInWindow();
		var extTab = tabs.find(t => t.title ==='dashboard | snoozz');
		if (extTab) chrome.tabs.reload(extTab.id);
	});

	chrome.runtime.onMessage.addListener(async msg => {
		if (msg.updateDash) {
			var tabs = await getSnoozedTabs();
			CACHED_TABS = tabs;
			fillTimeGroups();
		}
	});
	var search = document.getElementById('search');
	search.addEventListener('input', _ => {
		search.parentElement.classList.toggle('searching', search.value && search.value.length && search.value.length > 0);
		fillTimeGroups(search.value.toLowerCase());
	})

	CACHED_TABS = await getSnoozedTabs();
	HISTORY = await getOptions('history');

	buildTimeGroups();
	fillTimeGroups();
}

function setupClock() {
	var clockStyle = Object.assign(document.createElement('style'), {type: 'text/css'});
	var NOW = dayjs();
	var currentMin = parseInt(NOW.minute());
	var secAngle = parseInt(NOW.second()) * 6;

	var rotate = num => `transform: rotate(${num}deg)`;

	var secKeyframe = document.createTextNode(`@keyframes tick-tock { from { ${rotate(secAngle)}} to { ${rotate(secAngle + 360)}} }`);

	setTimeout(function moveMinuteHand() {
		currentMin++;
		document.querySelector('.minute').style.transform = `rotate(${(currentMin * 6)}deg)`
		setTimeout(moveMinuteHand, 60000)
	}, (60 - NOW.second()) * 1000);

	var hourRule = document.createTextNode(`.hour { ${rotate(180 + ((NOW.hour() % 12) * 30))} }`);
	var minRule = document.createTextNode(`.minute { ${rotate((NOW.minute()) * 6)} }`);
	var secRule = document.createTextNode('.second { animation-name: tick-tock }');

	clockStyle.append(secKeyframe, hourRule, minRule, secRule);
	document.body.append(clockStyle);

}

function buildTimeGroups() {
	var container = document.getElementById('time-container');
	
	TIME_GROUPS.forEach(t => {
		var tID = t.replace(/ /g,"_").toLowerCase();
		var timeGroup = Object.assign(document.createElement('div'), {className: 'time-group', id: tID});
		var header = Object.assign(document.createElement('div'), {className: 'flex time-header'});
		var name = Object.assign(document.createElement('h2'), {className: 'time-name', innerText: t});
		var timeAction = Object.assign(document.createElement('div'), {
			className: `time-action`,
			innerText: tID === 'history' ? 'clear history' : 'wake up all'
		});
		timeAction.addEventListener('click', async _ => {
			var ids = Array.from(document.querySelectorAll(`#${tID} .tab`)).map(t =>t.id);
			await (tID === 'history' ? removeTabsFromHistory(ids) : wakeUpTabsAbruptly(ids));
		}, {once: true})
		header.append(name, timeAction);
		timeGroup.append(header);
		container.append(timeGroup);
	});
}

function updateTimeGroups() {
	TIME_GROUPS.forEach(name => {
		var tg = document.getElementById(name.replace(/ /g,"_").toLowerCase())
		var tabCount = Array.from(tg.querySelectorAll('.tab')).length
		tg.classList.toggle('hidden', tabCount === 0)
		tg.querySelector('.time-action').classList.toggle('hidden', tabCount < 2);
	})
	document.getElementById('no-tabs').classList.toggle('hidden', document.querySelector('.tab'));
}

function matchQuery(t, query) {
	if (t.url && t.url.toLowerCase().indexOf(query) > -1) return true;
	if (t.title && t.title.toLowerCase().indexOf(query) > -1) return true;
	if (t.opened && dayjs(t.opened).format('dddd DD MMMM A').toLowerCase().indexOf(query) > -1) return true;
	if (!t.opened && t.wakeUpTime && dayjs(t.wakeUpTime).format('dddd DD MMMM A').toLowerCase().indexOf(query) > -1) return true;
	if (t.timeCreated && dayjs(t.timeCreated).format('dddd DD MMMM A').toLowerCase().indexOf(query) > -1) return true;
	if (getTimeGroup(t).toLowerCase().indexOf(query) > -1) return true;
	if (t.opened && ('deleted removed opened awake').indexOf(query) > -1) return true;
	return false;
}

function fillTimeGroups(searchQuery) {
	var tabs = CACHED_TABS;
	document.querySelectorAll('#time-container p, #time-container .tab').forEach(el => el.remove());
	// search
	if (searchQuery && searchQuery.length && searchQuery.length > 2) tabs = tabs.filter(t => {
		return matchQuery(t, searchQuery) || (t.tabs && t.tabs.some(tt => matchQuery(tt, searchQuery)));
	})
	var s = sleeping(tabs);
	if (s.length > 0) s.sort((t1,t2) => t1.wakeUpTime - t2.wakeUpTime).forEach(f => document.getElementById(getTimeGroup(f)).append(buildTab(f)))

	var a = tabs.filter(t => t.opened);
	if (a.length > 0) {
		a.sort((t1,t2) => t2.opened - t1.opened).forEach(h => document.getElementById(getTimeGroup(h)).append(buildTab(h)))	
		document.getElementById('history').appendChild(Object.assign(document.createElement('p'),{
			innerText: `Tabs in your history are removed ${HISTORY} day${HISTORY>1?'s':''} after they are opened.`
		}));
	}
	document.getElementById('api-message').classList.toggle('hidden', s.length === 0 && a.length === 0)
	updateTimeGroups();
}

function buildTab(t) {
	var tab = wrapInDiv({className:`tab${t.tabs ? ' window collapsed':''}`, id: t.id});

	var icon = Object.assign(document.createElement('img'), {className: 'icon', src: getIconForTab(t)});
	icon.onerror = () => icon.src = '../icons/unknown.png';
	var iconContainer = wrapInDiv('icon-container', icon);

	var title = wrapInDiv({className: 'tab-name', innerText: t.title, title: t.url ?? ''})
	if (t.opened && !t.tabs) title.addEventListener('click', _ => openTab(t));
	var startedNap = Object.assign(document.createElement('div'), {
		className: 'nap-time',
		innerText: `Started napping at ${dayjs(t.timeCreated).format('h:mm a [on] ddd D MMM YYYY')}`,
	});
	var titleContainer = wrapInDiv('title-container', title, startedNap);

	var wakeUpLabel = Object.assign(document.createElement('div'), {
		className: 'wakeup-label',
		innerText: t.deleted ? 'Deleted on' : (t.opened ? `Woke up ${t.opened < t.wakeUpTime ? 'manually' : 'automatically'} on` : 'Waking up')
	});
	var wakeUpTime = Object.assign(document.createElement('div'), {
		className: 'wakeup-time',
		innerText: t.opened ? dayjs(t.opened).format('dddd, D MMM') : formatSnoozedUntil(t.wakeUpTime),
		title: dayjs(t.opened ? t.opened : t.wakeUpTime).format('h:mm a [on] ddd, D MMMM YYYY')
	});
	var wakeUpTimeContainer = wrapInDiv('wakeup-time-container', wakeUpLabel, wakeUpTime);

	var littleTabs = '';
	if (t.tabs && t.tabs.length) {
		littleTabs = wrapInDiv('tabs');
		t.tabs.forEach(lt => {
			var littleIcon = Object.assign(document.createElement('img'), {className: 'little-icon', src: getIconForTab(lt)});
			var littleTitle = wrapInDiv({className: 'tab-name', innerText: lt.title});
			var littleTab = wrapInDiv('little-tab', littleIcon, littleTitle);
			littleTab.addEventListener('click', _ => openTab(lt));
			littleTabs.append(littleTab);
		});

		[iconContainer, titleContainer].forEach(c => c.addEventListener('click', _ => tab.classList.toggle('collapsed')))
	}

	var wakeUpBtn = Object.assign(document.createElement('div'), {className:'wakeup-button', innerHTML: !t.opened ? '<span>Wake up now</span>' : ''});
	wakeUpBtn.addEventListener('click', async _ => await wakeUpTabsAbruptly([t.id]));
	var wakeUpBtnContainer = wrapInDiv('wakeup-btn-container', wakeUpBtn)

	var removeBtn = Object.assign(document.createElement('img'), {className:'remove-button', src: '../icons/close.svg',title: 'Delete'});
	removeBtn.addEventListener('click', async _ => t.opened ? await removeTabsFromHistory([t.id]) : await sendTabsToHistory([t.id]));
	var removeBtnContainer = wrapInDiv('remove-btn-container', removeBtn)

	tab.append(iconContainer, titleContainer, wakeUpTimeContainer, wakeUpBtnContainer, removeBtnContainer, littleTabs);
	return tab;
}

var getIconForTab = t => t.tabs && t.tabs.length ? '../icons/dropdown.svg': (t.favicon && t.favicon !== '' ? t.favicon : getFaviconUrl(t.url));

function formatSnoozedUntil(ts) {
	var date = dayjs(ts);
	if (date.dayOfYear() === dayjs().dayOfYear()) return (date.hour() > 17 ? 'Tonight' : 'Today') + date.format(' [@] h:mm a');
	if (date.dayOfYear() === dayjs().add(1,'d').dayOfYear()) return 'Tomorrow' + date.format(' [@] h:mm a');
	if (date.week() === dayjs().week()) return date.format('ddd [@] h:mm a');
	return date.format('ddd, MMM D [@] h:mm a');
}

function getTimeGroup(t) {
	if (t.opened) return 'history';
	var time = dayjs(t.wakeUpTime);
	var now = dayjs()
	if (time.dayOfYear() === now.dayOfYear()) 				return 'today';
	if (time.dayOfYear() === now.add(1, 'd').dayOfYear()) 	return 'tomorrow';
	if (time.week() === now.week()) 						return 'this_week';
	if (time.week() === now.add(1, 'week').week()) 			return 'next_week';
	return 'later';
}

async function wakeUpTabsAbruptly(ids) {
	if (!ids) return;
	var tabs = CACHED_TABS;
	tabs.filter(t => ids.includes(t.id)).forEach(t => t.opened = dayjs().valueOf())
	chrome.runtime.sendMessage({logOptions: ['manually', ids]});
	await saveTabs(tabs);
	for (var t of tabs.filter(n => ids.includes(n.id))) t.tabs && t.tabs.length ? await openWindow(t) : await openTab(t);
	CACHED_TABS = tabs;
	fillTimeGroups();
}

async function sendTabsToHistory(ids) {
	if (!ids) return;
	var tabs = CACHED_TABS;
	tabs.filter(t => ids.includes(t.id)).forEach(t => {
		t.opened = dayjs().valueOf();
		t.deleted = true;
	});
	chrome.runtime.sendMessage({logOptions: ['history', ids]});
	await saveTabs(tabs);
	CACHED_TABS = tabs;
	fillTimeGroups();
}

async function removeTabsFromHistory(ids) {
	if (!ids) return;
	if (ids.length > 1 && !confirm('Are you sure you want to remove multiple tabs? \nYou can\'t undo this.')) return;
	var tabs = CACHED_TABS;
	tabs = tabs.filter(t => !ids.includes(t.id));
	chrome.runtime.sendMessage({logOptions: ['delete', ids]});
	await saveTabs(tabs);
	CACHED_TABS = tabs;
	fillTimeGroups()
}

window.onload = init