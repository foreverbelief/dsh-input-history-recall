window.__ModuleLoader__.load({
	id: "dsh-input-history-recall",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let React = require("react");

		/** Double-press detection window (ms): two presses of the same arrow within this gap count as one history gesture. */
		const DOUBLE_PRESS_MS = 200;

		/** Extract the plain text of one content-block array (LLM ContentBlock currency: type==='text'). */
		function textOfContent(content) {
			if (!Array.isArray(content)) return '';
			var text = '';
			for (var i = 0; i < content.length; i++) {
				var block = content[i];
				if (block && block.type === 'text' && typeof block.text === 'string') text += block.text;
			}
			return text.trim();
		}

		/**
		 * Resolve the display kind of one chat view node. New chat nodes carry
		 * the renderer kind on the node (`kind: 'user'`) with the durable
		 * message payload under `data`; legacy records carry `kind` directly.
		 */
		function kindOfNode(node) {
			if (!node) return '';
			if (typeof node.kind === 'string' && node.kind !== '') return node.kind;
			if (node.data && typeof node.data.kind === 'string') return node.data.kind;
			return '';
		}

		/** Resolve the content-block array of one node across both record shapes. */
		function contentOfNode(node) {
			if (!node) return null;
			if (node.data && Array.isArray(node.data.content)) return node.data.content;
			if (Array.isArray(node.content)) return node.content;
			return null;
		}

		/**
		 * Session-scoped component: renders nothing, but attaches a capture-phase
		 * keydown listener on `document` that implements the gesture:
		 *   - single press ArrowUp / ArrowDown -> native cursor movement (untouched)
		 *   - quick double-press of the same arrow -> history recall
		 *       Up   = walk backwards through this session's sent user messages
		 *       Down = walk forward again; past the newest restores the draft
		 *              that was in the box before entering history
		 *
		 * Data comes entirely from the standard slot props: the session lifecycle
		 * hook (useSession), the assembled-conversation hook (useConversation),
		 * and the input machine (useInput / inputActions). History is read from
		 * the chat view snapshot in render order (authoritative) with a fallback
		 * to the legacy `session.nodes` field; no cross-boundary fetch runs.
		 */
		function HistoryRecall(props) {
			var useSession = props.useSession;
			var useChat = props.useChat;
			var useConversation = props.useConversation;
			var useInput = props.useInput;
			var inputActions = props.inputActions;
			var sessionId = props.sessionId;

			// Standard session-scope sources (all conditionally absent-proof).
			// - useChat: authoritative chat snapshot source (ui-chat registers
			//   the 'chat' hook through uiSession.provide for every session
			//   binding; subscribing also activates the chat view target).
			// - useConversation: assembled-conversation fallback reading the
			//   same chat snapshot through the view store.
			// - useSession: legacy `nodes` fallback (the field no longer exists
			//   on the Session snapshot in the Lexical UI).
			// Absent standard hooks degrade to constant empty sources instead of
			// crashing the entry (hooks must be called unconditionally, so this
			// is the only safe way to tolerate a partial source roster).
			var NOOP_SELECT = function () { return undefined; };
			var chatHook = typeof useChat === 'function' ? useChat : NOOP_SELECT;
			var conversationHook = typeof useConversation === 'function' ? useConversation : NOOP_SELECT;
			var sessionHook = typeof useSession === 'function' ? useSession : NOOP_SELECT;
			var inputHook = typeof useInput === 'function' ? useInput : NOOP_SELECT;
			var chat = chatHook(function (s) { return s; });
			var conversation = conversationHook(function (s) { return s; });
			var legacyNodes = sessionHook(function (s) { return s && s.nodes; });
			var input = inputHook(function (s) { return s; });
			var draft = input ? input.draft : '';

			// Refs keep the single mounted listener reading fresh values.
			var histRef = React.useRef([]);
			var navRef = React.useRef({ pos: 0, buffer: '', appliedText: undefined });
			var pressRef = React.useRef({ key: '', time: 0 });
			var actionsRef = React.useRef(inputActions);
			actionsRef.current = inputActions;
			var draftRef = React.useRef(draft);
			draftRef.current = draft;
			var inputRef = React.useRef(input);
			inputRef.current = input;

			/**
			 * History = plain text of all user-authored messages in this
			 * session's loaded window, chronological (newest last). The chat
			 * target snapshot is the authoritative source: its `order` holds
			 * stable conversation keys in render order and `nodes.get(key)`
			 * returns the materialized node (kind `user` / `steering` carry the
			 * user's own text; injected `context` rows are excluded).
			 */
			var hist = React.useMemo(function () {
				var out = [];
				// useChat delivers the chat snapshot directly (or its empty
				// placeholder before the target materializes). Prefer it; fall
				// back to the conversation view store for older assemblies.
				var chatSnap = chat;
				if ((chatSnap === null || chatSnap === undefined)
					&& conversation && conversation.views && typeof conversation.views.get === 'function') {
					chatSnap = conversation.views.get('chat');
				}
				if (chatSnap && Array.isArray(chatSnap.order) && chatSnap.nodes && typeof chatSnap.nodes.get === 'function') {
					var order = chatSnap.order;
					for (var i = 0; i < order.length; i++) {
						var node = chatSnap.nodes.get(order[i]);
						var kind = kindOfNode(node);
						if (kind !== 'user' && kind !== 'steering') continue;
						var blocks = contentOfNode(node);
						var text = blocks === null ? '' : textOfContent(blocks);
						if (text !== '') out.push(text);
					}
				}
				// Fallback: legacy `session.nodes` shape (array of user records).
				if (out.length === 0 && Array.isArray(legacyNodes)) {
					for (var k = 0; k < legacyNodes.length; k++) {
						var old = legacyNodes[k];
						if (!old || old.kind !== 'user') continue;
						var oldText = textOfContent(old.content);
						if (oldText !== '') out.push(oldText);
					}
				}
				return out;
			}, [chat, conversation, legacyNodes]);

			histRef.current = hist;

			// History/session changed -> reset to the end (not navigating).
			React.useEffect(function () {
				var nav = navRef.current;
				nav.pos = hist.length;
				nav.buffer = draftRef.current;
				nav.appliedText = undefined;
			}, [hist, sessionId]);
			// Manual edit of the draft (not one of our setDraft writes) -> exit navigation, back to the end.
			React.useEffect(function () {
				var nav = navRef.current;
				if (nav.appliedText !== undefined && draft === nav.appliedText) {
					nav.appliedText = undefined;
					return;
				}
				nav.appliedText = undefined;
				nav.pos = histRef.current.length;
				nav.buffer = draft;
			}, [draft]);

			React.useEffect(function () {
				function apply(index) {
					var nav = navRef.current;
					var text = histRef.current[index];
					if (text === undefined) return;
					nav.appliedText = text;
					var actions = actionsRef.current;
					if (actions) actions.setDraft(text);
				}
				function applyEnd() {
					var nav = navRef.current;
					nav.appliedText = nav.buffer;
					var actions = actionsRef.current;
					if (actions) actions.setDraft(nav.buffer);
				}
				function inComposer(target) {
					if (!target || typeof target.closest !== 'function') return false;
					// Current UI: Lexical contenteditable host flagged data-composer-input.
					if (target.closest('[data-composer-input]') !== null) return true;
					// Legacy UI: plain composer textarea.
					if (target instanceof HTMLTextAreaElement) {
						return target.closest('[data-composer-card]') !== null;
					}
					return false;
				}
				function hasOpenOverlay(target) {
					// An open slash/command overlay inside the composer owns the
					// arrow keys (highlight navigation): never hijack them here.
					if (!target || typeof target.closest !== 'function') return false;
					var card = target.closest('[data-composer-card]');
					if (card === null) return false;
					return card.querySelector('[data-trigger-menu], [role="listbox"]') !== null;
				}
				function onKeyDown(e) {
					if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
					if (e.repeat) return; // holding the key: keep native cursor behavior
					if (e.isComposing || e.keyCode === 229) return; // IME composition
					if (e.shiftKey) return; // Shift+arrow = selection extension
					if (!inComposer(e.target)) return; // composer surface only
					var actions = actionsRef.current;
					var st = inputRef.current;
					if (!actions || !st) return;
					// Command claim present or busy phases: don't hijack the arrows.
					if (st.claim !== undefined || st.phase === 'adjudicating' || st.phase === 'submitting') return;
					// Slash/command menu open inside the composer: arrows drive the menu.
					if (hasOpenOverlay(e.target)) return;

					var now = Date.now();
					var press = pressRef.current;
					var isDouble = press.key === e.key && (now - press.time) <= DOUBLE_PRESS_MS;
					press.key = e.key;
					press.time = now;
					if (!isDouble) return; // first press: hand to native cursor movement

					var hist = histRef.current;
					if (hist.length === 0) return;
					e.preventDefault();
					e.stopPropagation();

					var nav = navRef.current;
					if (e.key === 'ArrowUp') {
						if (nav.pos === hist.length) nav.buffer = draftRef.current; // stash current draft before entering history
						if (nav.pos > 0) {
							nav.pos -= 1;
							apply(nav.pos);
						}
					} else if (nav.pos < hist.length) {
						nav.pos += 1;
						if (nav.pos === hist.length) applyEnd(); // past the newest: restore the stashed draft
						else apply(nav.pos);
					}
				}
				document.addEventListener('keydown', onKeyDown, true);
				return function () { document.removeEventListener('keydown', onKeyDown, true); };
			}, []);

			return null;
		}

		exports.apply = function apply(ctx) {
			var slots = ctx.get('slots');
			if (slots === undefined) return;
			slots.inject('conversation.input.overlay', function () {
				return slots.register(
					{ name: 'conversation.input.overlay', id: 'input-history-recall', order: 10 },
					function (props) { return React.createElement(HistoryRecall, props); },
				);
			});
		};

		return module.exports;
	}
});
