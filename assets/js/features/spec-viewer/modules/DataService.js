/**
 * @typedef {Object} SubscribeCallbacks
 * @property {(updatedData: Object, previousData: Object) => void} [onUpdate]
 * @property {(error: Error) => void} [onError]
 */

/**
 * @typedef {Object} PollingCallbacks
 * @property {(updatedData: Object) => Promise<void>|void} [onSpecReloaded]
 * @property {() => void} [onDone]
 * @property {(error: Error) => void} [onError]
 */

const _state = {
  spec: null,
  specUnsubscribe: null,
  pollInterval: null,
  specHash: '',
  loadingStates: {
    overview: false,
    diagrams: false,
    prompts: false,
    mockups: false,
    mindmap: false,
    general: false
  }
};

const _listeners = {
  specUpdated: new Set(),
  loadingChanged: new Set()
};

function mirrorLegacyWindowState() {
  if (typeof window !== 'undefined') {
    window.currentSpecData = _state.spec;
  }
}

function getFirestore() {
  return firebase.firestore();
}

function clearSubscription() {
  if (_state.specUnsubscribe) {
    _state.specUnsubscribe();
    _state.specUnsubscribe = null;
  }
}

function emit(event, payload) {
  const listeners = _listeners[event];
  if (!listeners) return;
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (error) {
      window.appLogger?.logError?.(error, { context: `DataService.emit:${event}` });
    }
  });
}

function buildSpecHash(spec) {
  if (!spec) return '';
  return JSON.stringify({
    id: spec.id,
    status: spec.status,
    overview: spec.overview,
    technical: spec.technical,
    market: spec.market,
    design: spec.design,
    architecture: spec.architecture,
    prompts: spec.prompts,
    mindMap: spec.mindMap,
    visibility: spec.visibility,
    mockups: spec.mockups
  });
}

function resolveScope(scope) {
  const scopeAliases = {
    promptLoading: 'prompts',
    diagramLoading: 'diagrams'
  };
  const resolvedScope = scopeAliases[scope] || scope;
  if (resolvedScope in _state.loadingStates) return resolvedScope;
  window.appLogger?.warn?.('Unknown loading scope; using general', { scope });
  return 'general';
}

export function getState() {
  return _state.spec;
}

export function getSpec() {
  return _state.spec;
}

export function setSpec(newData) {
  const nextHash = buildSpecHash(newData);
  const changed = nextHash !== _state.specHash;
  _state.spec = newData;
  _state.specHash = nextHash;
  mirrorLegacyWindowState();
  if (changed) {
    emit('specUpdated', _state.spec);
  }
  return _state.spec;
}

export async function patchSpec(partial, { firestore = true } = {}) {
  const current = _state.spec || {};
  const next = { ...current, ...partial };
  setSpec(next);

  if (firestore && next.id) {
    await getFirestore().collection('specs').doc(next.id).update({
      ...partial,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  return _state.spec;
}

export async function patchState(partial, options = {}) {
  return patchSpec(partial, options);
}

export function on(event, cb) {
  if (!_listeners[event] || typeof cb !== 'function') {
    return () => {};
  }
  _listeners[event].add(cb);
  return () => off(event, cb);
}

export function off(event, cb) {
  if (!_listeners[event]) return;
  _listeners[event].delete(cb);
}

export function setLoading(scope, status) {
  const key = resolveScope(scope);
  const next = Boolean(status);
  if (_state.loadingStates[key] === next) return;
  _state.loadingStates[key] = next;
  emit('loadingChanged', { scope: key, status: next });
}

export function isLoading(scope = 'general') {
  if (scope === 'any') {
    return Object.values(_state.loadingStates).some(Boolean);
  }
  const key = resolveScope(scope);
  return Boolean(_state.loadingStates[key]);
}

export async function loadSpec(specId, { isAdminCheck } = {}) {
  if (!specId) {
    throw new Error('No specification ID provided');
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error('User must be authenticated to view specifications');
  }

  const doc = await getFirestore().collection('specs').doc(specId).get();
  if (!doc.exists) {
    throw new Error('Specification not found');
  }

  const data = { id: doc.id, ...doc.data() };
  const isOwner = data.userId === user.uid;
  const isAdmin = typeof isAdminCheck === 'function' ? !!isAdminCheck(user) : false;

  return { data, user, isOwner, isAdmin };
}

export function subscribeSpec(specId, callbacks = {}) {
  clearSubscription();
  stopStatusPolling();

  _state.specUnsubscribe = getFirestore()
    .collection('specs')
    .doc(specId)
    .onSnapshot((doc) => {
      if (!doc.exists) return;
      const updatedData = { id: doc.id, ...doc.data() };
      const previousData = _state.spec || {};
      setSpec(updatedData);
      callbacks.onUpdate?.(updatedData, previousData);
    }, (error) => {
      callbacks.onError?.(error);
    });

  return () => {
    clearSubscription();
  };
}

export async function saveSpec({ user, spec }) {
  if (!user) {
    throw new Error('User must be authenticated to save to Firebase');
  }

  const specDoc = {
    title: spec.title || 'App Specification',
    overview: spec.overview,
    technical: spec.technical,
    market: spec.market,
    status: spec.status || {
      overview: 'ready',
      technical: 'pending',
      market: 'pending'
    },
    overviewApproved: spec.overviewApproved || false,
    answers: spec.answers || [],
    userId: user.uid,
    userName: user.displayName || user.email || 'Anonymous User',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await getFirestore().collection('specs').add(specDoc);
  return docRef.id;
}

export function stopStatusPolling() {
  if (_state.pollInterval) {
    clearInterval(_state.pollInterval);
    _state.pollInterval = null;
  }
}

export function isPolling() {
  return Boolean(_state.pollInterval);
}

export function startStatusPolling(specId, callbacks = {}) {
  stopStatusPolling();
  let pollCount = 0;
  const maxPolls = 120;

  _state.pollInterval = setInterval(async () => {
    pollCount += 1;
    try {
      const statusResponse = await window.api.get(`/api/specs/${specId}/generation-status`);
      if (statusResponse.job) {
        const jobStatus = statusResponse.job.status;
        if (jobStatus === 'completed' || jobStatus === 'failed') {
          stopStatusPolling();
          if (_state.spec && _state.spec.id === specId) {
            const doc = await getFirestore().collection('specs').doc(specId).get();
            if (doc.exists) {
              const updatedData = { id: doc.id, ...doc.data() };
              setSpec(updatedData);
              await callbacks.onSpecReloaded?.(updatedData);
            }
          }
          callbacks.onDone?.();
        }
      }

      if (_state.spec && _state.spec.id === specId) {
        const doc = await getFirestore().collection('specs').doc(specId).get();
        if (doc.exists) {
          const specData = doc.data();
          const status = specData.status || {};
          const allDone = ['technical', 'market', 'design'].every((stage) =>
            status[stage] === 'ready' || status[stage] === 'error');
          if (allDone) {
            stopStatusPolling();
            callbacks.onDone?.();
          }
        }
      }
    } catch (error) {
      console.warn('Polling error:', error);
      callbacks.onError?.(error);
    }

    if (pollCount >= maxPolls) {
      stopStatusPolling();
      console.log('Stopped polling after max attempts');
    }
  }, 5000);
}

export function teardown() {
  clearSubscription();
  stopStatusPolling();
  Object.keys(_listeners).forEach((event) => _listeners[event].clear());
}

