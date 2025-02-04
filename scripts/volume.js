(function ($) {

	AblePlayer.prototype.addVolumeSlider = function($div) {

		// input type="range" requires IE10 and later
		// and still isn't supported by Opera Mini as of v8
		// Also, vertical orientation of slider requires CSS hacks
		// and causes problems in some screen readers
		// Therefore, building a custom vertical volume slider
		var thisObj, volumeSliderId, volumeHelpId, x, y, volumePct;

		thisObj = this;

		// define a few variables
		volumeSliderId = this.mediaId + '-volume-slider';
		volumeHelpId = this.mediaId + '-volume-help';
		this.volumeTrackHeight = 50; // must match CSS height for .able-volume-slider
		this.volumeHeadHeight = 7; // must match CSS height for .able-volume-head
		this.volumeTickHeight = this.volumeTrackHeight / 10;

		this.$volumeSlider = $('<div>',{
			'id': volumeSliderId,
			'class': 'able-volume-slider',
			'aria-hidden': 'true'
		}).hide();
		this.$volumeSliderTooltip = $('<div>',{
			'class': 'able-tooltip',
			'role': 'tooltip'
		}).hide();
		this.$volumeSliderTrack = $('<div>',{
			'class': 'able-volume-track'
		});
		this.$volumeSliderTrackOn = $('<div>',{
			'class': 'able-volume-track able-volume-track-on'
		});
		this.$volumeSliderHead = $('<div>',{
			'class': 'able-volume-head',
			'role': 'slider',
			'aria-orientation': 'vertical',
			'aria-label': this.tt.volumeUpDown,
			'aria-valuemin': 0,
			'aria-valuemax': 10,
			'aria-valuenow': this.volume,
			'tabindex': -1
		});
		this.$volumeSliderTrack.append(this.$volumeSliderTrackOn,this.$volumeSliderHead);
		this.$volumeAlert = $('<div>',{
			'class': 'able-offscreen',
			'aria-live': 'assertive',
			'aria-atomic': 'true'
		});
		volumePct = parseInt(thisObj.volume) / 10 * 100;
		this.$volumeHelp = $('<div>',{
			'id': volumeHelpId,
			'class': 'able-volume-help'
		}).text(volumePct + '%, ' + this.tt.volumeHelp);
		this.$volumeButton.attr({
			'aria-describedby': volumeHelpId
		});
		this.$volumeSlider.append(this.$volumeSliderTooltip,this.$volumeSliderTrack,this.$volumeAlert,this.$volumeHelp)
		$div.append(this.$volumeSlider);
		this.refreshVolumeSlider(this.volume);

		// add event listeners
		this.$volumeSliderHead.on('mousedown',function (e) {
			e.preventDefault(); // prevent text selection (implications?)
			thisObj.draggingVolume = true;
			thisObj.volumeHeadPositionTop = $(this).offset().top;
		});

		// prevent dragging after mouseup as mouseup not detected over iframe (YouTube)
		this.$mediaContainer.on('mouseover',function (e) {
			if(thisObj.player == 'youtube'){
				thisObj.draggingVolume = false;
			}
		});

		$(document).on('mouseup',function (e) {
			thisObj.draggingVolume = false;
		});

		$(document).on('mousemove',function (e) {
			if (thisObj.draggingVolume) {
				x = e.pageX;
				y = e.pageY;
				thisObj.moveVolumeHead(y);
			}
		});

		this.$volumeSliderHead.on('keydown',function (e) {

			// Left arrow or down arrow
			if (e.which === 37 || e.which === 40) {
				thisObj.handleVolume('down');
			}
			// Right arrow or up arrow
			else if (e.which === 39 || e.which === 38) {
				thisObj.handleVolume('up');
			}
			// Escape key or Enter key or Tab key
			else if (e.which === 27 || e.which === 13 || e.which === 9) {
				// close popup
				if (thisObj.$volumeSlider.is(':visible')) {
					thisObj.closingVolume = true; // stopgap
					thisObj.hideVolumePopup();
				}
				else {
					if (!thisObj.closingVolume) {
						thisObj.showVolumePopup();
					}
				}
			}
			else {
				return;
			}
			e.preventDefault();
		});
	};

	AblePlayer.prototype.refreshVolumeSlider = function(volume) {

		// adjust slider position based on current volume
		var volumePct, volumePctText;
		volumePct = (volume/10) * 100;
		volumePctText = volumePct + '%';

		var trackOnHeight, trackOnTop, headTop;
		trackOnHeight = volume * this.volumeTickHeight;
		trackOnTop = this.volumeTrackHeight - trackOnHeight;
		headTop = trackOnTop - this.volumeHeadHeight;

		if (this.$volumeSliderTrackOn) {
			this.$volumeSliderTrackOn.css({
				'height': trackOnHeight + 'px',
				'top': trackOnTop + 'px'
			});
		}
		if (this.$volumeSliderHead) {
			this.$volumeSliderHead.attr({
				'aria-valuenow': volume,
				'aria-valuetext': volumePctText
			});
			this.$volumeSliderHead.css({
				'top': headTop + 'px'
			});
		}
		if (this.$volumeAlert) {
			this.$volumeAlert.text(volumePct + '%');
		}
	};

	AblePlayer.prototype.refreshVolumeButton = function(volume) {

		var volumeName, volumePct, volumeLabel, volumeIconClass, volumeImg, newSvgData;

		volumeName = this.getVolumeName(volume);
		volumePct = (volume/10) * 100;
		volumeLabel = this.tt.volume + ' ' + volumePct + '%';

		if (this.iconType === 'font') {
			volumeIconClass = 'icon-volume-' + volumeName;
			this.$volumeButton.find('span').first().removeClass().addClass(volumeIconClass);
			this.$volumeButton.find('span.able-clipped').text(volumeLabel);
		}
		else if (this.iconType === 'image') {
			volumeImg = this.imgPath + 'volume-' + volumeName + '.png';
			this.$volumeButton.find('img').attr('src',volumeImg);
		}
		else if (this.iconType === 'svg') {
			if (volumeName !== 'mute') {
				volumeName = 'volume-' + volumeName;
			}
			newSvgData = this.getSvgData(volumeName);
			this.$volumeButton.find('svg').attr('viewBox',newSvgData[0]);
			this.$volumeButton.find('path').attr('d',newSvgData[1]);
		}
	};

	AblePlayer.prototype.moveVolumeHead = function(y) {

		// y is current position after mousemove
		var diff, direction, ticksDiff, newVolume, maxedOut;

		var diff = this.volumeHeadPositionTop - y;

		// only move the volume head if user had dragged at least one tick
		// this is more efficient, plus creates a "snapping' effect
		if (Math.abs(diff) > this.volumeTickHeight) {
			if (diff > 0) {
				direction = 'up';
			}
			else {
				direction = 'down';
			}
			if (direction == 'up' && this.volume == 10) {
				// can't go any higher
				return;
			}
			else if (direction == 'down' && this.volume == 0) {
				// can't go any lower
				return;
			}
			else {
				ticksDiff = Math.round(Math.abs(diff) / this.volumeTickHeight);
				if (direction == 'up') {
					newVolume = this.volume + ticksDiff;
					if (newVolume > 10) {
						newVolume = 10;
					}
				}
				else { // direction is down
					newVolume = this.volume - ticksDiff;
					if (newVolume < 0) {
						newVolume = 0;
					}
				}
				this.setVolume(newVolume); // this.volume will be updated after volumechange event fires (event.js)
				this.refreshVolumeSlider(newVolume);
				this.refreshVolumeButton(newVolume);
				this.volumeHeadPositionTop = y;
			}
		}
	};

	AblePlayer.prototype.handleVolume = function(direction) {

		// 'direction is either 'up','down', or an ASCII key code 49-57 (numeric keys 1-9)
		// Action: calculate and change the volume
		// Don't change this.volume and this.volumeButton yet - wait for 'volumechange' event to fire (event.js)

		// If NO direction is provided, user has just clicked on the Volume button
		// Action: show slider
		var volume;

		if (typeof direction === 'undefined') {
			if (this.$volumeSlider.is(':visible')) {
				this.hideVolumePopup();
			}
			else {
				if (!this.closingVolume) {
					this.showVolumePopup();
				}
			}
			return;
		}

		if (direction >= 49 && direction <= 57) {
			volume = direction - 48;
		}
		else {

			volume = this.getVolume();

			if (direction === 'up' && volume < 10) {
				volume += 1;
			}
			else if (direction === 'down' && volume > 0) {
				volume -= 1;
			}
		}

		if (this.isMuted() && volume > 0) {
			this.setMute(false);
		}
		else if (volume === 0) {
			this.setMute(true);
		}
		else {
			this.setVolume(volume); // this.volume will be updated after volumechange event fires (event.js)
			this.refreshVolumeSlider(volume);
			this.refreshVolumeButton(volume);
		}
	};

	AblePlayer.prototype.handleMute = function() {

		if (this.isMuted()) {
			this.setMute(false);
		}
		else {
			this.setMute(true);
		}
	};

	AblePlayer.prototype.showVolumePopup = function() {

		this.closePopups();
		this.$tooltipDiv.hide();
		this.$volumeSlider.show().attr('aria-hidden','false');
		this.$volumeButton.attr('aria-expanded','true');
		this.$volumeButton.focus(); // for screen reader expanded state to be read
		this.waitThenFocus(this.$volumeSliderHead.attr('tabindex','0'));
	};

	AblePlayer.prototype.hideVolumePopup = function() {

		var thisObj = this;

		this.$volumeSlider.hide().attr('aria-hidden','true');
		this.$volumeSliderHead.attr('tabindex','-1');
		this.$volumeButton.attr('aria-expanded','false').focus();
		// wait a second before resetting stopgap var
		// otherwise the keypress used to close volume popup will trigger the volume button
		setTimeout(function() {
			thisObj.closingVolume = false;
		}, 1000);
	};

	AblePlayer.prototype.isMuted = function () {

		if (this.player === 'html5') {
			return this.media.muted;
		}
		else if (this.player === 'jw' && this.jwPlayer) {
			return this.jwPlayer.getMute();
		}
		else if (this.player === 'youtube') {
			return this.youTubePlayer.isMuted();
		}
	};

	AblePlayer.prototype.setMute = function(mute) {

		// mute is either true (muting) or false (unmuting)
		if (mute) {
			// save current volume so it can be restored after unmute
			this.lastVolume = this.volume;
			this.volume = 0;
		}
		else { // restore to previous volume
			if (typeof this.lastVolume !== 'undefined') {
				this.volume = this.lastVolume;
			}
		}

		if (this.player === 'html5') {
			this.media.muted = mute;
		}
		else if (this.player === 'jw' && this.jwPlayer) {
			this.jwPlayer.setMute(mute);
		}
		else if (this.player === 'youtube') {
			if (mute) {
				this.youTubePlayer.mute();
			}
			else {
				this.youTubePlayer.unMute();
			}
		}
		this.refreshVolumeSlider(this.volume);
		this.refreshVolumeButton(this.volume);
	};

	AblePlayer.prototype.setVolume = function (volume) {

		// volume is 1 to 10
		// convert as needed depending on player

		if (this.player === 'html5') {
			// volume is 0 to 1
			this.media.volume = volume / 10;
			if (this.hasSignLanguage && this.signVideo) {
				this.signVideo.volume = 0; // always mute
			}
		}
		else if (this.player === 'youtube') {
			// volume is 0 to 100
			this.youTubePlayer.setVolume(volume * 10);
			this.volume = volume;
		}
		else if (this.player === 'vimeo') {
			// volume is 0 to 1
			this.vimeoPlayer.setVolume(volume / 10).then(function() {
				// setVolume finished.
				// could do something here
				// successful completion also fires a 'volumechange' event (see event.js)
			});
		}
		else if (this.player === 'jw' && this.jwPlayer) {
			// volume is 0 to 100
			this.jwPlayer.setVolume(volume * 10);
		}
		this.lastVolume = volume;
	};

	AblePlayer.prototype.getVolume = function (volume) {

		// return volume using common audio control scale 1 to 10
		if (this.player === 'html5') {
			// uses 0 to 1 scale
			return this.media.volume * 10;
		}
		else if (this.player === 'youtube') {
			// uses 0 to 100 scale
			return this.youTubePlayer.getVolume() / 10;
		}
		if (this.player === 'vimeo') {
			// uses 0 to 1 scale
			// this.vimeoPlayer.getVolume() takes too long to resolve with a value
			// Just use variable that's already been defined (should be the same value anyway)
			return this.volume;
		}
		else if (this.player === 'jw' && this.jwPlayer) {
			// uses 0 to 100 scale
			return this.jwPlayer.getVolume() / 10;
		}
	};

	AblePlayer.prototype.getVolumeName = function (volume) {

		// returns 'mute','soft','medium', or 'loud' depending on volume level
		if (volume == 0) {
			return 'mute';
		}
		else if (volume == 10) {
			return 'loud';
		}
		else if (volume < 5) {
			return 'soft';
		}
		else {
			return 'medium';
		}
	};

})(jQuery);
