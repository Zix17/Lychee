/**
 * @description Takes care of every action a photo can handle and execute.
 */

photo = {

	json  : null,
	cache : null

}

photo.getID = function() {

	let id = null

	if (photo.json) id = photo.json.id
	else            id = $('.photo:hover, .photo.active').attr('data-id')

	if ($.isNumeric(id)===true) return id
	else                        return false

}

photo.load = function(photoID, albumID) {

	const checkContent = function() {
		if (album.json!=null) photo.load(photoID, albumID)
		else                  setTimeout(checkContent, 100)
	}

	const checkPasswd = function() {
		if (password.value!=='') photo.load(photoID, albumID)
		else                     setTimeout(checkPasswd, 200)
	}

	if (album.json==null) {
		checkContent()
		return false
	}

	let params = {
		photoID,
		albumID,
		password: password.value
	}

	api.post('Photo::get', params, function(data) {

		if (data==='Warning: Photo private!') {
			lychee.content.show()
			lychee.goto()
			return false
		}

		if (data==='Warning: Wrong password!') {
			checkPasswd()
			return false
		}

		photo.json = data

		if (!visible.photo()) view.photo.show()
		view.photo.init()
		lychee.imageview.show()

		setTimeout(() => {
			lychee.content.show()
			photo.preloadNext(photoID)
		}, 300)

	})

}

// Preload the next photo for better response time
photo.preloadNext = function(photoID) {

	if (album.json &&
	    album.json.content &&
	    album.json.content[photoID] &&
	    album.json.content[photoID].nextPhoto!='') {

		let nextPhoto = album.json.content[photoID].nextPhoto
		let url       = album.json.content[nextPhoto].url
		let medium    = album.json.content[nextPhoto].medium
		let href      = (medium!=null && medium!=='' ? medium : url)

		$('head [data-prefetch]').remove()
		$('head').append(`<link data-prefetch rel="prefetch" href="${ href }">`)

	}

}

photo.parse = function() {

	if (!photo.json.title) photo.json.title = 'Untitled'

}

photo.previous = function(animate) {

	if (photo.getID()!==false &&
	    album.json &&
	    album.json.content[photo.getID()] &&
	    album.json.content[photo.getID()].previousPhoto!=='') {

		let delay = 0

		if (animate===true) {

			delay = 200

			$('#imageview #image').css({
				WebkitTransform : 'translateX(100%)',
				MozTransform    : 'translateX(100%)',
				transform       : 'translateX(100%)',
				opacity         : 0
			})

		}

		setTimeout(() => {
			if (photo.getID()===false) return false
			lychee.goto(album.getID() + '/' + album.json.content[photo.getID()].previousPhoto)
		}, delay)

	}

}

photo.next = function(animate) {

	if (photo.getID()!==false &&
	    album.json &&
	    album.json.content[photo.getID()] &&
	    album.json.content[photo.getID()].nextPhoto!=='') {

		let delay = 0

		if (animate===true) {

			delay = 200

			$('#imageview #image').css({
				WebkitTransform : 'translateX(-100%)',
				MozTransform    : 'translateX(-100%)',
				transform       : 'translateX(-100%)',
				opacity         : 0
			})

		}

		setTimeout(() => {
			if (photo.getID()===false) return false
			lychee.goto(album.getID() + '/' + album.json.content[photo.getID()].nextPhoto)
		}, delay)

	}

}

photo.duplicate = function(photoIDs) {

	if (!photoIDs) return false
	if (photoIDs instanceof Array===false) photoIDs = [ photoIDs ]

	albums.refresh()

	let params = {
		photoIDs: photoIDs.join()
	}

	api.post('Photo::duplicate', params, function(data) {

		if (data!==true) lychee.error(null, params, data)
		else             album.load(album.getID())

	})

}

photo.delete = function(photoIDs) {

	let action     = {}
	let cancel     = {}
	let msg        = ''
	let photoTitle = ''

	if (!photoIDs) return false
	if (photoIDs instanceof Array===false) photoIDs = [ photoIDs ]

	if (photoIDs.length===1) {

		// Get title if only one photo is selected
		if (visible.photo()) photoTitle = photo.json.title
		else                 photoTitle = album.json.content[photoIDs].title

		// Fallback for photos without a title
		if (photoTitle==='') photoTitle = 'Untitled'

	}

	action.fn = function() {

		let nextPhoto = null
		let previousPhoto = null

		basicModal.close()

		photoIDs.forEach(function(id, index, array) {

			// Change reference for the next and previous photo
			if (album.json.content[id].nextPhoto!=='' || album.json.content[id].previousPhoto!=='') {

				nextPhoto     = album.json.content[id].nextPhoto
				previousPhoto = album.json.content[id].previousPhoto

				album.json.content[previousPhoto].nextPhoto = nextPhoto
				album.json.content[nextPhoto].previousPhoto = previousPhoto

			}

			delete album.json.content[id]
			view.album.content.delete(id)

		})

		albums.refresh()

		// Go to next photo if there is a next photo and
		// next photo is not the current one. Show album otherwise.
		if (visible.photo() && nextPhoto!=null && nextPhoto!==photo.getID()) lychee.goto(album.getID() + '/' + nextPhoto)
		else if (!visible.albums())                                          lychee.goto(album.getID())

		let params = {
			photoIDs: photoIDs.join()
		}

		api.post('Photo::delete', params, function(data) {

			if (data!==true) lychee.error(null, params, data)

		})

	}

	if (photoIDs.length===1) {

		action.title = 'Elimina Foto'
		cancel.title = 'Annulla'

		msg = lychee.html`<p>Eliminare la foto '$${ photoTitle }'?</p>`

	} else {

		action.title = 'Elimina Foto'
		cancel.title = 'Annulla'

		msg = lychee.html`<p>Eliminare le $${ photoIDs.length } foto selezionate?</p>`

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

photo.setTitle = function(photoIDs) {

	let oldTitle = ''
	let msg      = ''

	if (!photoIDs) return false
	if (photoIDs instanceof Array===false) photoIDs = [ photoIDs ]

	if (photoIDs.length===1) {

		// Get old title if only one photo is selected
		if (photo.json)      oldTitle = photo.json.title
		else if (album.json) oldTitle = album.json.content[photoIDs].title

	}

	const action = function(data) {

		basicModal.close()

		let newTitle = data.title

		if (visible.photo()) {
			photo.json.title = (newTitle==='' ? 'Untitled' : newTitle)
			view.photo.title()
		}

		photoIDs.forEach(function(id, index, array) {
			album.json.content[id].title = newTitle
			view.album.content.title(id)
		})

		let params = {
			photoIDs : photoIDs.join(),
			title    : newTitle
		}

		api.post('Photo::setTitle', params, function(data) {

			if (data!==true) lychee.error(null, params, data)

		})

	}

	let input = lychee.html`<input class='text' name='title' type='text' maxlength='100' placeholder='Titolo' value='$${ oldTitle }'>`

	if (photoIDs.length===1) msg = lychee.html`<p>Inserisci un nuovo titolo per questa foto: ${ input }</p>`
	else                     msg = lychee.html`<p>Inserisci un titolo per le $${ photoIDs.length } foto selezionate: ${ input }</p>`

	basicModal.show({
		body: msg,
		buttons: {
			action: {
				title: 'Imposta titolo',
				fn: action
			},
			cancel: {
				title: 'Annulla',
				fn: basicModal.close
			}
		}
	})

}

photo.setAlbum = function(photoIDs, albumID) {

	let nextPhoto = null
	let previousPhoto = null

	if (!photoIDs) return false
	if (photoIDs instanceof Array===false) photoIDs = [ photoIDs ]

	photoIDs.forEach(function(id, index, array) {

		// Change reference for the next and previous photo
		if (album.json.content[id].nextPhoto!==''||album.json.content[id].previousPhoto!=='') {

			nextPhoto     = album.json.content[id].nextPhoto
			previousPhoto = album.json.content[id].previousPhoto

			album.json.content[previousPhoto].nextPhoto = nextPhoto
			album.json.content[nextPhoto].previousPhoto = previousPhoto

		}

		delete album.json.content[id]
		view.album.content.delete(id)

	})

	albums.refresh()

	// Go to next photo if there is a next photo and
	// next photo is not the current one. Show album otherwise.
	if (visible.photo() && nextPhoto!=null && nextPhoto!==photo.getID()) lychee.goto(album.getID() + '/' + nextPhoto)
	else if (!visible.albums())                                          lychee.goto(album.getID())

	let params = {
		photoIDs: photoIDs.join(),
		albumID
	}

	api.post('Photo::setAlbum', params, function(data) {

		if (data!==true) lychee.error(null, params, data)

	})

}

photo.setStar = function(photoIDs) {

	if (!photoIDs) return false

	if (visible.photo()) {
		photo.json.star = (photo.json.star==='0' ? '1' : '0')
		view.photo.star()
	}

	photoIDs.forEach(function(id, index, array) {
		album.json.content[id].star = (album.json.content[id].star==='0' ? '1' : '0')
		view.album.content.star(id)
	})

	albums.refresh()

	let params = {
		photoIDs: photoIDs.join()
	}

	api.post('Photo::setStar', params, function(data) {

		if (data!==true) lychee.error(null, params, data)

	})

}

photo.setPublic = function(photoID, e) {

	if (photo.json.public==='2') {

		const action = function() {

			basicModal.close()
			lychee.goto(photo.json.original_album)

		}

		basicModal.show({
			body: '<p>Questa foto è contenuta in un album pubblico. Per rendere questa foto privata, modificare la visibilità dell album.</p>',
			buttons: {
				action: {
					title: 'Mostra Album',
					fn: action
				},
				cancel: {
					title: 'Annulla',
					fn: basicModal.close
				}
			}
		})

		return false

	}

	if (visible.photo()) {

		photo.json.public = (photo.json.public==='0' ? '1' : '0')
		view.photo.public()
		if (photo.json.public==='1') contextMenu.sharePhoto(photoID, e)

	}

	album.json.content[photoID].public = (album.json.content[photoID].public==='0' ? '1' : '0')
	view.album.content.public(photoID)

	albums.refresh()

	api.post('Photo::setPublic', { photoID }, function(data) {

		if (data!==true) lychee.error(null, params, data)

	})

}

photo.setDescription = function(photoID) {

	let oldDescription = photo.json.description

	const action = function(data) {

		basicModal.close()

		let description = data.description

		if (visible.photo()) {
			photo.json.description = description
			view.photo.description()
		}

		let params = {
			photoID,
			description
		}

		api.post('Photo::setDescription', params, function(data) {

			if (data!==true) lychee.error(null, params, data)

		})

	}

	basicModal.show({
		body: lychee.html`<p>Inserisci una descrizione per questa foto: <input class='text' name='description' type='text' maxlength='800' placeholder='Description' value='$${ oldDescription }'></p>`,
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

photo.editTags = function(photoIDs) {

	let oldTags = ''
	let msg     = ''

	if (!photoIDs) return false
	if (photoIDs instanceof Array===false) photoIDs = [ photoIDs ]

	// Get tags
	if (visible.photo())                              oldTags = photo.json.tags
	else if (visible.album() && photoIDs.length===1)  oldTags = album.json.content[photoIDs].tags
	else if (visible.search() && photoIDs.length===1) oldTags = album.json.content[photoIDs].tags
	else if (visible.album() && photoIDs.length>1) {
		let same = true
		photoIDs.forEach(function(id, index, array) {
			if (album.json.content[id].tags===album.json.content[photoIDs[0]].tags && same===true) same = true
			else                                                                                   same = false
		})
		if (same===true) oldTags = album.json.content[photoIDs[0]].tags
	}

	// Improve tags
	oldTags = oldTags.replace(/,/g, ', ')

	const action = function(data) {

		basicModal.close()
		photo.setTags(photoIDs, data.tags)

	}

	let input = lychee.html`<input class='text' name='tags' type='text' maxlength='800' placeholder='Tags' value='$${ oldTags }'>`

	if (photoIDs.length===1) msg = lychee.html`<p>Inserisci i Tag per questa foto. <br> Puoi inserire Tag multipli separandoli con una virgola: ${ input }</p>`
	else                     msg = lychee.html`<p>Inserisci i Tag per le $${ photoIDs.length } foto selezionate. I Tag esistenti saranno sovrascritti. <br> Puoi inserire Tag multipli separandoli con una virgola: ${ input }</p>`

	basicModal.show({
		body: msg,
		buttons: {
			action: {
				title: 'Imposta Tags',
				fn: action
			},
			cancel: {
				title: 'Annulla',
				fn: basicModal.close
			}
		}
	})

}

photo.setTags = function(photoIDs, tags) {

	if (!photoIDs) return false
	if (photoIDs instanceof Array===false) photoIDs = [ photoIDs ]

	// Parse tags
	tags = tags.replace(/(\ ,\ )|(\ ,)|(,\ )|(,{1,}\ {0,})|(,$|^,)/g, ',')
	tags = tags.replace(/,$|^,|(\ ){0,}$/g, '')

	if (visible.photo()) {
		photo.json.tags = tags
		view.photo.tags()
	}

	photoIDs.forEach(function(id, index, array) {
		album.json.content[id].tags = tags
	})

	let params = {
		photoIDs: photoIDs.join(),
		tags
	}

	api.post('Photo::setTags', params, function(data) {

		if (data!==true) lychee.error(null, params, data)

	})

}

photo.deleteTag = function(photoID, index) {

	let tags

	// Remove
	tags = photo.json.tags.split(',')
	tags.splice(index, 1)

	// Save
	photo.json.tags = tags.toString()
	photo.setTags([ photoID ], photo.json.tags)

}

photo.share = function(photoID, service) {

	let url  = photo.getViewLink(photoID)

	switch (service) {
		case 'twitter':
			window.open(`https://twitter.com/share?url=${ encodeURI(url) }`)
			break
		case 'facebook':
			window.open(`http://www.facebook.com/sharer.php?u=${ encodeURI(url) }&t=${ encodeURI(photo.json.title) }`)
			break
		case 'mail':
			location.href = `mailto:?subject=${ encodeURI(photo.json.title) }&body=${ encodeURI(url) }`
			break
		case 'dropbox':
			lychee.loadDropbox(function() {
				let filename = photo.json.title + '.' + photo.getDirectLink().split('.').pop()
				Dropbox.save(photo.getDirectLink(), filename)
			})
			break
	}

}

photo.getArchive = function(photoID) {

	let link
	let url = `${ api.path }?function=Photo::getArchive&photoID=${ photoID }`

	if (location.href.indexOf('index.html')>0) link = location.href.replace(location.hash, '').replace('index.html', url)
	else                                       link = location.href.replace(location.hash, '') + url

	if (lychee.publicMode===true) link += `&password=${ encodeURIComponent(password.value) }`

	location.href = link

}

photo.getDirectLink = function() {

	let url = ''

	if (photo.json && photo.json.url && photo.json.url!=='') url = photo.json.url

	return url

}

photo.getViewLink = function(photoID) {

	let url = 'view.php?p=' + photoID

	if (location.href.indexOf('index.html')>0) return location.href.replace('index.html' + location.hash, url)
	else                                       return location.href.replace(location.hash, url)

}