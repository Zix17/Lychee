/**
 * @description Takes care of every action an album can handle and execute.
 */

const buildAlbumOptions = function(albums, select, parent = 0, layer = 0) {

	var cmbxOptions = ''

	for (i in albums) {
		if (albums[i].parent==parent) {

			let title = (layer>0 ? '&nbsp;&nbsp;'.repeat(layer - 1) + '└ ' : '') + albums[i].title
			let selected = select==albums[i].id ? ' selected="selected"' : ''

			cmbxOptions += `<option${ selected } value='${ albums[i].id }'>${ title }</option>`
			cmbxOptions += buildAlbumOptions(albums, select, albums[i].id, layer + 1)

		}
	}

	return cmbxOptions

}

album = {

	json: null,
	subjson: null

}

album.isSmartID = function(id) {

	return (id==='0' || id==='f' || id==='s' || id==='r')

}

album.getID = function() {

	let id = null

	let isID = (id) => {
		if (album.isSmartID(id)===true) return true
		return $.isNumeric(id)
	}

	// Search
	if (isID(id)===false) id = $('.album:hover, .album.active').attr('data-id')
	if (isID(id)===false) id = $('.photo:hover, .photo.active').attr('data-album-id')

	if (isID(id)===false) {
		if (photo.json)      id = photo.json.album
		else if (album.json) id = album.json.id
	}

	if (isID(id)===true) return id

	return false

}

album.getParent = function() {

	if (album.json==null || album.isSmartID(album.json.id)===true || album.json.parent==0) return ''

	return album.json.parent

}

album.load = function(albumID, refresh = false) {

	password.get(albumID, function() {

		if (refresh===false) lychee.animate('.content', 'contentZoomOut')

		let startTime = new Date().getTime()

		let params = {
			albumID,
			password: password.value
		}

		api.post('Album::get', params, function(data) {

			let waitTime = 0

			if (data==='Warning: Album private!') {

				if (document.location.hash.replace('#', '').split('/')[1]!=undefined) {
					// Display photo only
					lychee.setMode('view')
				} else {
					// Album not public
					lychee.content.show()
					lychee.goto()
				}
				return false
			}

			if (data==='Warning: Wrong password!') {
				album.load(albumID, refresh)
				return false
			}

			album.json = data

			// Calculate delay
			let durationTime = (new Date().getTime() - startTime)
			if (durationTime>300) waitTime = 0
			else                  waitTime = 300 - durationTime

			// Skip delay when refresh is true
			// Skip delay when opening a blank Lychee
			if (refresh===true)                                            waitTime = 0
			if (!visible.albums() && !visible.photo() && !visible.album()) waitTime = 0

			setTimeout(() => {

				let finish = function() {
					view.album.init()

					if (refresh===false) {
						lychee.animate(lychee.content, 'contentZoomIn')
						header.setMode('album')
					}
				}

				if (album.isSmartID(albumID)===false) {

					params = {
						parent: albumID
					}

					api.post('Albums::get', params, function(data) {

						let waitTime = 0

						album.subjson = data

						// Calculate delay
						let durationTime = (new Date().getTime() - startTime)
						if (durationTime>300) waitTime = 0
						else                  waitTime = 300 - durationTime

						setTimeout(finish, waitTime)

					})

				} else {

					finish()

				}

			}, waitTime)

		})
	})

}

album.parse = function() {

	if (!album.json.title) album.json.title = 'Untitled'

}

album.add = function(albumID = 0) {

	const action = function(data) {

		let title = data.title
		let parent = albumID

		const isNumber = (n) => (!isNaN(parseFloat(n)) && isFinite(n))

		basicModal.close()

		let params = {
			title,
			parent
		}

		api.post('Album::add', params, function(data) {

			if (data!==false && isNumber(data)) {
				albums.refresh()
				lychee.goto(data)
			} else {
				lychee.error(null, params, data)
			}

		})

	}

	api.post('Albums::get', { parent: -1 }, function(data) {

		let msg = `
		          <p>Inserisci un titolo per il nuovo album: <input class='text' name='title' type='text' maxlength='250' placeholder='Title' value='Senza Titolo'></p>
		          `

		basicModal.show({
			body: msg,
			buttons: {
				action: {
					title: 'Crea Album',
					fn: action
				},
				cancel: {
					title: 'Annulla',
					fn: basicModal.close
				}
			}
		})

	})

}

album.delete = function(albumIDs) {

	let action = {}
	let cancel = {}
	let msg    = ''

	if (!albumIDs) return false
	if (albumIDs instanceof Array===false) albumIDs = [ albumIDs ]

	action.fn = function() {

		basicModal.close()

		let params = {
			albumIDs: albumIDs.join()
		}

		api.post('Album::delete', params, function(data) {

			if (visible.albums()) {

				albumIDs.forEach(function(id) {
					albums.json.num--
					view.albums.content.delete(id)
					albums.deleteByID(id)
				})

			} else if (visible.album()) {

				// if we deleted the current album, go to its parent
				if (albumIDs.length==1 && album.json.id==albumIDs[0]) {

					let id = album.getParent()
					album.refresh()
					lychee.goto(id)

				}
				// otherwise, we deleted a subalbum
				else {
					album.reload()
				}

			} else {

				albums.refresh()
				lychee.goto()

			}

			if (data!==true) lychee.error(null, params, data)

		})

	}

	if (albumIDs.toString()==='0') {

		action.title = 'Elimina Unsorted'
		cancel.title = 'Annulla'

		msg = `<p>Eliminare tutte le foto contenute in 'Unsorted'?</p>`

	} else if (albumIDs.length===1) {

		let albumTitle = ''

		action.title = 'Elimina Album e Foto'
		cancel.title = 'Annulla'

		// Get title
		if (album.json && album.json.id == albumIDs[0]) albumTitle = album.json.title
		else if (albums.json || album.subjson)          albumTitle = albums.getByID(albumIDs).title

		// Fallback for album without a title
		if (albumTitle==='') albumTitle = 'Untitled'

		msg = lychee.html`<p>Eliminare l'album '$${ albumTitle }' comprese le Foto e Album al suo interno?</p>`

	} else {

		action.title = 'Elimina Album e Foto'
		cancel.title = 'Annulla'

		msg = lychee.html`<p>Eliminare i $${ albumIDs.length } Album selezionati e le Foto\Album al loro interno?</p>`

	}

	basicModal.show({
		body: msg,
		buttons: {
			action: {
				title: action.title,
				fn: action.fn,
				class: 'red'
			},
			cancel: {
				title: cancel.title,
				fn: basicModal.close
			}
		}
	})

}

album.setTitle = function(albumIDs) {

	let oldTitle = ''
	let msg      = ''

	if (!albumIDs) return false
	if (albumIDs instanceof Array===false) albumIDs = [ albumIDs ]

	if (albumIDs.length===1) {

		// Get old title if only one album is selected
		if (album.json && album.json.id == albumIDs[0]) oldTitle = album.json.title
		else if (albums.json || album.subjson)          oldTitle = albums.getByID(albumIDs).title

	}

	const action = function(data) {

		basicModal.close()

		let newTitle = data.title

		if (visible.album()) {

			// Rename only one album

			if (album.json.id == albumIDs[0]) {
				album.json.title = newTitle
				view.album.title()
			}

			if (albums.json || album.subjson) {
				albumIDs.forEach(function(id) {
					let a = albums.getByID(id)
					if (a) {
						a.title = newTitle
						view.album.content.title(id)
					}
				})
			}

		} else if (visible.albums()) {

			// Rename all albums

			albumIDs.forEach(function(id) {
				albums.getByID(id).title = newTitle
				view.albums.content.title(id)
			})

		}

		let params = {
			albumIDs : albumIDs.join(),
			title    : newTitle
		}

		api.post('Album::setTitle', params, function(data) {

			if (data!==true) lychee.error(null, params, data)

		})

	}

	let input = lychee.html`<input class='text' name='title' type='text' maxlength='250' placeholder='Titolo' value='$${ oldTitle }'>`

	if (albumIDs.length===1) msg = lychee.html`<p>Inserisci un nuovo titolo per questo Album: ${ input }</p>`
	else                     msg = lychee.html`<p>Inserisci un titolo per i $${ albumIDs.length } Album selezionati: ${ input }</p>`

	basicModal.show({
		body: msg,
		buttons: {
			action: {
				title: 'Imposta Titolo',
				fn: action
			},
			cancel: {
				title: 'Annulla',
				fn: basicModal.close
			}
		}
	})

}

album.setDescription = function(albumID) {

	let oldDescription = album.json.description

	const action = function(data) {

		let description = data.description

		basicModal.close()

		if (visible.album()) {
			album.json.description = description
			view.album.description()
		}

		let params = {
			albumID,
			description
		}

		api.post('Album::setDescription', params, function(data) {

			if (data!==true) lychee.error(null, params, data)

		})

	}

	basicModal.show({
		body: lychee.html`<p>Inserisci una descrizione per questo Album: <input class='text' name='description' type='text' maxlength='4800' placeholder='Descrizione' value='$${ oldDescription }'></p>`,
		buttons: {
			action: {
				title: 'Imposta Descrizione',
				fn: action
			},
			cancel: {
				title: 'Annulla',
				fn: basicModal.close
			}
		}
	})

}

album.setPublic = function(albumID, modal, e) {

	let password = ''

	albums.refresh()

	if (modal===true) {

		let text   = ''
		let action = {}

		action.fn = () => {

			// Call setPublic function without showing the modal
			album.setPublic(album.getID(), false, e)

		}

		// Album public = Editing a shared album
		if (album.json.public==='1') {

			action.title = 'Modifica Condivisione'
			text         = 'Le impostazioni di condivisione di questo Album saranno sostituite con le seguenti:'

		} else {

			action.title = 'Condividi Album'
			text         = 'Questo Album sarà condiviso con le seguenti impostazioni:'

		}

		let msg = `
		          <p class='less'>${ text }</p>
		          <form>
		              <div class='choice'>
		                  <label>
		                      <input type='checkbox' name='hidden'>
		                      <span class='checkbox'>${ build.iconic('check') }</span>
		                      <span class='label'>Nascosto</span>
		                  </label>
		                  <p>Solo chi è in possesso di un link diretto può visualizzare questo Album.</p>
		              </div>
		              <div class='choice'>
		                  <label>
		                      <input type='checkbox' name='downloadable'>
		                      <span class='checkbox'>${ build.iconic('check') }</span>
		                      <span class='label'>Scaricabile</span>
		                  </label>
		                  <p>I Visitatori possono scaricare questo Album.</p>
		              </div>
		              <div class='choice'>
		                  <label>
		                      <input type='checkbox' name='password'>
		                      <span class='checkbox'>${ build.iconic('check') }</span>
		                      <span class='label'>Protetto con Password</span>
		                  </label>
		                  <p>Album protetto con password.</p>
		                  <input class='text' name='passwordtext' type='password' placeholder='password' value=''>
		              </div>
		          </form>
		          `

		basicModal.show({
			body: msg,
			buttons: {
				action: {
					title: action.title,
					fn: action.fn
				},
				cancel: {
					title: 'Annulla',
					fn: basicModal.close
				}
			}
		})

		if (album.json.public==='1' && album.json.visible==='0') $('.basicModal .choice input[name="hidden"]').click()
		if (album.json.downloadable==='1')                       $('.basicModal .choice input[name="downloadable"]').click()

		$('.basicModal .choice input[name="password"]').on('change', function() {

			if ($(this).prop('checked')===true) $('.basicModal .choice input[name="passwordtext"]').show().focus()
			else                                $('.basicModal .choice input[name="passwordtext"]').hide()

		})

		return true

	}

	// Set data
	if (basicModal.visible()) {

		// Visible modal => Set album public
		album.json.public = '1'

		// Set visible
		if ($('.basicModal .choice input[name="hidden"]:checked').length===1) album.json.visible = '0'
		else                                                                  album.json.visible = '1'

		// Set downloadable
		if ($('.basicModal .choice input[name="downloadable"]:checked').length===1) album.json.downloadable = '1'
		else                                                                        album.json.downloadable = '0'

		// Set password
		if ($('.basicModal .choice input[name="password"]:checked').length===1) {
			password            = $('.basicModal .choice input[name="passwordtext"]').val()
			album.json.password = '1'
		} else {
			password            = ''
			album.json.password = '0'
		}

		// Modal input has been processed, now it can be closed
		basicModal.close()

	} else {

		// Modal not visible => Set album private
		album.json.public = '0'

	}

	// Set data and refresh view
	if (visible.album()) {

		album.json.visible      = (album.json.public==='0') ? '1' : album.json.visible
		album.json.downloadable = (album.json.public==='0') ? '0' : album.json.downloadable
		album.json.password     = (album.json.public==='0') ? '0' : album.json.password

		view.album.public()
		view.album.hidden()
		view.album.downloadable()
		view.album.password()

		if (album.json.public==='1') contextMenu.shareAlbum(albumID, e)

	}

	let params = {
		albumID,
		public       : album.json.public,
		password     : password,
		visible      : album.json.visible,
		downloadable : album.json.downloadable
	}

	api.post('Album::setPublic', params, function(data) {

		if (data!==true) lychee.error(null, params, data)

	})

}

album.share = function(service) {

	let url  = location.href

	switch (service) {
		case 'twitter':
			window.open(`https://twitter.com/share?url=${ encodeURI(url) }`)
			break
		case 'facebook':
			window.open(`http://www.facebook.com/sharer.php?u=${ encodeURI(url) }&t=${ encodeURI(album.json.title) }`)
			break
		case 'mail':
			location.href = `mailto:?subject=${ encodeURI(album.json.title) }&body=${ encodeURI(url) }`
			break
	}

}

album.getArchive = function(albumID) {

	let link = ''
	let url  = `${ api.path }?function=Album::getArchive&albumID=${ albumID }`

	if (location.href.indexOf('index.html')>0) link = location.href.replace(location.hash, '').replace('index.html', url)
	else                                       link = location.href.replace(location.hash, '') + url

	if (lychee.publicMode===true) link += `&password=${ encodeURIComponent(password.value) }`

	location.href = link

}

const getMessage = function(albumIDs, titles, operation) {

	let title  = ''
	let sTitle = ''
	let msg    = ''

	if (!albumIDs) return false
	if (albumIDs instanceof Array===false) albumIDs = [ albumIDs ]

	// Get title of first album
	if (titles.length > 0)                 title = titles[0]
	else if (albums.json || album.subjson) title = albums.getByID(albumIDs[0]).title

	// Fallback for first album without a title
	if (title==='') title = 'Untitled'

	if (albumIDs.length===2) {

		// Get title of second album
		if (titles.length > 1)                 sTitle = titles[1]
		else if (albums.json || album.subjson) sTitle = albums.getByID(albumIDs[1]).title

		// Fallback for second album without a title
		if (sTitle==='') sTitle = 'Untitled'

		msg = lychee.html`<p>${ operation } l'Album '$${ sTitle }' su '$${ title }'?</p>`

	} else {

		msg = lychee.html`<p>${ operation } gli album selezionati su '$${ title }'?</p>`

	}

	return msg

}

album.merge = function(albumIDs, titles = []) {

	const action = function() {

		basicModal.close()

		let params = {
			albumIDs: albumIDs.join()
		}

		api.post('Album::merge', params, function(data) {

			if (data!==true) lychee.error(null, params, data)
			else             album.reload()

		})

	}

	basicModal.show({
		body: getMessage(albumIDs, titles, 'Unire'),
		buttons: {
			action: {
				title: 'Unisci Album',
				fn: action,
				class: 'red'
			},
			cancel: {
				title: "Annulla",
				fn: basicModal.close
			}
		}
	})

}

album.move = function(albumIDs, titles = []) {

	const action = function() {

		basicModal.close()

		let params = {
			albumIDs: albumIDs.join()
		}

		api.post('Album::move', params, function(data) {

			if (data!==true) lychee.error(null, params, data)
			else             album.reload()

		})

	}

	basicModal.show({
		body: getMessage(albumIDs, titles, 'Spostare'),
		buttons: {
			action: {
				title: 'Sposta Album',
				fn: action,
				class: 'red'
			},
			cancel: {
				title: "Annulla",
				fn: basicModal.close
			}
		}
	})

}

album.reload = function() {

	let albumID = album.getID()

	album.refresh()
	albums.refresh()

	if (visible.album()) lychee.goto(albumID)
	else                 lychee.goto()

}

album.refresh = function() {

	album.json = null
	album.subjson = null

}