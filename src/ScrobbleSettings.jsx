import { useState } from 'react'
import {
  connectListenBrainz,
  disconnectLastfm,
  disconnectListenBrainz,
  lastfmKeys,
  setLastfmKeys,
  startLastfmLogin,
  useScrobbleSettings,
} from './scrobble.js'

function ListenBrainz({ settings }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (settings.lbToken) {
    return (
      <div className="scrobble-row">
        <span>
          Connecté : <b>{settings.lbUser}</b>
        </span>
        <button className="btn-link" onClick={disconnectListenBrainz}>
          Déconnecter
        </button>
      </div>
    )
  }
  async function connect(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await connectListenBrainz(token)
      setToken('')
    } catch (err) {
      setError(err instanceof TypeError ? 'Pas de connexion à ListenBrainz.' : err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={connect}>
      <p className="scrobble-help">
        Copie ton jeton sur{' '}
        <a href="https://listenbrainz.org/settings/" target="_blank" rel="noreferrer">
          listenbrainz.org/settings
        </a>{' '}
        puis colle-le ici.
      </p>
      <div className="scrobble-field">
        <input type="password" placeholder="Jeton ListenBrainz" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        <button className="scrobble-btn" disabled={!token.trim() || busy}>
          {busy ? '…' : 'Connecter'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

function Lastfm({ settings }) {
  const keys = lastfmKeys(settings)
  const hasKeys = Boolean(keys.key && keys.secret)
  const [showKeys, setShowKeys] = useState(!hasKeys)
  const [key, setKey] = useState(settings.lfmKey ?? '')
  const [secret, setSecret] = useState(settings.lfmSecret ?? '')
  return (
    <>
      {settings.lfmSession ? (
        <div className="scrobble-row">
          <span>
            Connecté : <b>{settings.lfmUser}</b>
          </span>
          <button className="btn-link" onClick={disconnectLastfm}>
            Déconnecter
          </button>
        </div>
      ) : (
        <button className="scrobble-btn scrobble-btn--wide" onClick={startLastfmLogin} disabled={!hasKeys}>
          Connecter Last.fm
        </button>
      )}
      {showKeys ? (
        <form
          className="scrobble-keys"
          onSubmit={(e) => {
            e.preventDefault()
            setLastfmKeys(key, secret)
            if (key.trim() && secret.trim()) setShowKeys(false)
          }}
        >
          <p className="scrobble-help">
            Last.fm demande une clé d'application. Crée-la sur{' '}
            <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
              last.fm/api/account/create
            </a>{' '}
            (le nom et la description importent peu, laisse l'URL de rappel vide), puis copie la clé et le secret ici.
          </p>
          <input placeholder="Clé API" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <input type="password" placeholder="Secret partagé" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" />
          <button className="scrobble-btn">Enregistrer</button>
        </form>
      ) : (
        !settings.lfmSession && (
          <button className="btn-link" onClick={() => setShowKeys(true)}>
            Utiliser ma propre clé API
          </button>
        )
      )}
    </>
  )
}

export default function ScrobbleSettings({ count, total, lastStatus, onClose }) {
  const settings = useScrobbleSettings()
  return (
    <div className="wheel-backdrop" onClick={onClose}>
      <div className="scrobble-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Scrobbling">
        <div className="scrobble-head">
          <h2>Scrobbling</h2>
          <button className="btn-link" onClick={onClose}>
            Fermer
          </button>
        </div>
        <p className="scrobble-help">
          Envoie les chansons que tu écoutes à ton profil. Seules les stations avec la liste des chansons comptent ({count} sur {total}), et pas les
          pubs ni les DJ. Une chanson est comptée après la moitié (ou 4 minutes) écoutée.
        </p>
        <section>
          <h3>ListenBrainz</h3>
          <ListenBrainz settings={settings} />
        </section>
        <section>
          <h3>Last.fm</h3>
          <Lastfm settings={settings} />
        </section>
        {lastStatus?.state === 'error' && <p className="error">{lastStatus.error}</p>}
        {lastStatus?.state === 'done' && (
          <p className="scrobble-help">
            Dernière envoyée : {lastStatus.song.artist} – {lastStatus.song.track}
          </p>
        )}
      </div>
    </div>
  )
}
