<template>
	<div>
		<div class="btns-wrap" ref="scrollToActiveBtn">
			<button
				:class="btn.name === activeBtnName ? 'active_btn' : ''"
				v-for="(btn, index) in categoriesSort()"
				:key="btn.weight + index"
				@click="filterFont(btn)"
			>{{btn.name}}</button>
		</div>
		<div class="font-list">
			<p v-if="lookingActiveFont" class="looking-font">
				Looking Current Font
				<span>.</span>
				<span>.</span>
				<span>.</span>
			</p>
			<span class="loading-fonts" :style="{opacity: loadedFonts ? 1 : 0}"></span>
			<ul :style="{visibility: lookingActiveFont ? 'hidden' : 'visible'}" type="none" @scroll="loadMoreFonts" ref="fontListUL" class="picker-ul">
				<li v-if="fontList.length === 0" class="text-center no_font_result">No Font</li>
				<template v-else>
					<li
						v-for="(font, index) in fontList"
						:key="font + (index + startIndex)"
						:style="{ fontFamily: `'${font}'`, top: calcTop(startIndex + index), height: liHeight + 'px'}"
						@click="selectFont(font)"
						:class="[snippetFontFamily === font && 'active_font', disabledFont === font ? 'disabled-font' : '']"
					>{{font}}</li>
				</template>
			</ul>
		</div>
	</div>
</template>

<script>

import ClientFontLoader from './ClientFontLoader';
import log from 'lib/Logger';
import { mapState } from 'vuex';
import {
	DISABLED_FONTS
} from 'helpers/constants';

export default {
	name: 'font-picker',
	props: {
		'fonts': {
			default: (font) => font,
			required: true,
			type: Array
		},
		'fontGroups': {
			default: (font) => font,
			required: true,
			type: Array
		},
		'searchVal': {
			default: '',
			required: false,
			type: String
		}
	},
	data() {
		return {
			currentFonts: [],
			categories: [],
			currentFontGroup: [],
			pageSize: 50,
			currentCategory: {},
			minFontNumber: 0,
			maxFontNumber: 0,
			fontsArrByLoad: [],
			loadedFonts: false,
			searchFonts: '',
			customDebounce: null,
			currentCategoriesIndex: 0,
			activeBtnName: 'All Fonts',
			selectedFont: '',
			fontList: [],
			liHeight: 28,
			containerHeight: 350,
			scrollPos: 0,
			topIndex: 0,
			startIndex: 0,
			allowScrolling: false,
			lookingActiveFont: true,
			searchListFonts: [],
			filteredListFonts: [],
			disabledFont: null,
		}
	},
	watch: {
		'searchVal': {
			handler () {
				this.customDebounce && clearTimeout(this.customDebounce);
				this.loadedFonts = true;
				this.customDebounce = setTimeout(() => {
					this.fontsArrByLoad = [];
					this.searchFonts = this.$props.searchVal;
					// Need to reset font picker's info when we are going to do filtration
					if (this.searchFonts) {
						this.currentCategoriesIndex = 0;
						this.activeBtnName = 'All Fonts';
					}
					this.categoriesSort()
					this.$nextTick(() => {
						this.allowScrolling = false;
						this.fontList = this.loadFonts(this.$props.fonts, this.activeBtnName, this.pageSize, 0, this.searchFonts);
						if (this.searchFonts){
							this.$refs.scrollToActiveBtn.scroll({
								top: 0,
								left: this.$refs.scrollToActiveBtn.querySelector('.active_btn').offsetLeft - 20,
								behavior: 'smooth'
							});
							this.$refs.fontListUL.scroll({
								top: 0,
							})
						}
						this.allowScrolling = true;
					})
					if (!this.searchFonts) {
						this.searchListFonts = [];
					}
				}, 400);
			}
		}
	},
	created() {
		this.watchCustomFontList = this.$store.watch(// Watching changes of Uploaded Fonts
			(state, _getters) => state.editor.customFontsList,
			(_newValue, _oldValue) => {
				this.currentCategoriesIndex = 1;
				this.activeBtnName = 'Uploaded';
				this.categoriesSort();
				this.$emit('removeValue');
				this.fontList = this.loadFonts(this.$props.fonts, this.activeBtnName, this.pageSize, 0, this.searchFonts);
			}
		)
	},
	beforeDestroy() {
		this.watchCustomFontList();
	},
	computed: {
		...mapState({
			fontFilter: state => state.editor.fontFilter,
			snippetFontFamily: state => state.editor.activeSnippetData.fontFamily,
			customFontsList: state => state.editor.customFontsList,
		}),
		bottomIndex () {
			return ~~(this.containerHeight / this.liHeight) + this.topIndex;
		}
	},
	async mounted () {
		if (this.customFontsList.includes(this.snippetFontFamily)) { // For custom uploaded fonts
			this.$store.commit('editor/SET_FILTER_TAB_OF_FONT', {pos: 1, name: 'Uploaded'});
		}
		// Load initial fonts
		this.categoriesSort();
		this.getFonts();
		this.findCurrentFontList()
	},
	methods: {
		categoriesSort () {
			let _categ = this.fontGroups.map((item, index) => {
				return {
					name: item.label,
					pos: index + 2 /*Added two custom type (all and uploaded)*/,
					weight: item.weight
				};
			});
			_categ.unshift({
				name: 'All Fonts',
				pos: 0,
				weight: 0
			}, {
				name: 'Uploaded',
				pos: 1,
				weight: 1
			});
			log.debug(_categ);
			_categ.sort(function (a, b) {
				if (a.weight < b.weight) {
					return -1;
				} else if (a.weight > b.weight) {
					return 1;
				} else {
					return 0;
				}
			});
			this.currentCategory = _categ[this.currentCategoriesIndex];
			return _categ
		},
		calcTop (index) {
			return index * this.liHeight  + 'px'
		},
		getFonts () {
			const getActiveFontIndex = this.$props.fonts.indexOf(this.snippetFontFamily);
			if (getActiveFontIndex !== -1) {
				const startIndex = (getActiveFontIndex + this.customFontsList.length < this.pageSize / 2 ? 0 : getActiveFontIndex + this.customFontsList.length - this.pageSize / 2);
				this.fontList = this.loadFonts(this.$props.fonts, this.currentCategory.name, this.pageSize, startIndex, this.searchFonts);
			} else {
				this.fontList = this.loadFonts(this.$props.fonts, 'All Fonts', this.pageSize, 0, this.searchFonts);
			}
		},
		findCurrentFontList () {
			this.fontsArrByLoad = [];
			this.activeBtnName = 'All Fonts';
			this.currentCategoriesIndex = 0;
			this.categoriesSort();
			this.goToFontsPosition()
			.then(_ => {
				if (this.$refs.fontListUL) {
					const top = this.$refs.fontListUL.querySelector('.active_font') && this.$refs.fontListUL.querySelector('.active_font').offsetTop;
					// For Active font's name button
					this.$refs.fontListUL.scroll({
						top,
						behavior: 'smooth'
					})
					function checkScrollEnd() {
						if (this.$refs.fontListUL && (this.$refs.fontListUL.scrollY || this.$refs.fontListUL.scrollTop) + this.$refs.fontListUL.getBoundingClientRect().height < top) {
							this.allowScrolling = false;
							requestAnimationFrame(checkScrollEnd.bind(this));
						}
						else {
							this.$emit('isLookingFont', false);
							this.lookingActiveFont = false;
							this.allowScrolling = true;
						}
					}
					requestAnimationFrame(checkScrollEnd.bind(this));
				}
			}).catch(err => console.error(err))
		},
		goToFontsPosition () {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					try {
						if (!this.$refs.scrollToActiveBtn.querySelector('.active_btn')) {
							throw 'Not active Element';
						}
						// For Active Group's button
						this.$refs.scrollToActiveBtn.scroll({
							top: 0,
							left: this.$refs.scrollToActiveBtn.querySelector('.active_btn').offsetLeft - 20,
							behavior: 'smooth'
						});
						setTimeout(() => {
							resolve()
						}, 500);
					} catch (err) {
						reject(err);
					}
				}, 500)
			})
		},
		checkExistedFont (i) {
			if(this.fontsArrByLoad.indexOf(this.filteredListFonts[i]) === -1) {
				ClientFontLoader.loadFont(this.filteredListFonts[i])
				this.fontsArrByLoad[i] = this.filteredListFonts[i];
			}
			this.checkDisabledFonts(this.fontsArrByLoad);
		},
		mutateFontList () {
			const middleIndex = Math.round((this.topIndex + this.bottomIndex) / 2);
			const fakeFontList = [];
			const fonts = this.searchListFonts.length ? this.searchListFonts : this.filteredListFonts;
			// load above fonts
			if (middleIndex >= this.pageSize / 2) { // if there are already more than 25 fonts
				for (let i = middleIndex; i >= middleIndex - this.pageSize / 2; i--) {
					if (!fonts[i]) continue;
					fakeFontList[i] = fonts[i];
					this.checkExistedFont(i);
				}
			} else {
				for (let i = middleIndex; i >= 0; i--) {
					if (!fonts[i]) continue;
					fakeFontList[i] = fonts[i]
					this.checkExistedFont(i);
				}
			}
			// load bellow fonts
			const endIndex = (middleIndex < this.pageSize / 2) ? (middleIndex + this.pageSize / 2) + this.pageSize / 2 - middleIndex : middleIndex + this.pageSize / 2;
			for (let i = middleIndex; i < endIndex; i++) {
				if (!fonts[i]) continue;
				fakeFontList[i] = fonts[i];
				this.checkExistedFont(i);
			}
			this.checkDisabledFonts(fakeFontList);
			this.startIndex = (middleIndex - this.pageSize / 2) < 0 ? 0 : middleIndex - this.pageSize / 2;
			this.fontList = fakeFontList.slice(this.startIndex, this.startIndex + this.pageSize)
		},
		checkDisabledFonts (fontList) { // Watching the main font list if there will be a disabled font it must be removed from list
			if (DISABLED_FONTS.indexOf(this.snippetFontFamily) === -1) {
				DISABLED_FONTS.forEach((font) => {
					const findIndex = fontList.indexOf(font);
					if (findIndex > -1) {
						fontList.splice(findIndex, 1)
					}
				})
			}
		},
		loadMoreFonts ({ target: { scrollTop, _clientHeight, _scrollHeight }}) {
			if (!this.allowScrolling) return;
			this.topIndex = ~~(scrollTop / this.liHeight)
			this.mutateFontList();
		},
		filterFont (button) {
			this.allowScrolling = false;
			this.activeBtnName = button.name;
			this.fontsArrByLoad = [];
			this.filteredListFonts = [];
			this.currentCategoriesIndex = button.pos;
			this.categoriesSort();
			this.$nextTick(() => {
				this.fontList = this.loadFonts(this.$props.fonts, this.activeBtnName, this.pageSize, 0, this.searchFonts);
				this.$refs.fontListUL.scroll({
					top: 0,
				})
				this.allowScrolling = true;
			});
			this.$emit('removeValue')
		},
		selectFont(font) {
			this.selectedFont = font;
			this.$store.commit('editor/SET_FILTER_TAB_OF_FONT', {pos: this.currentCategoriesIndex, name: this.activeBtnName});
			this.$emit('select-font', font);
		},
		changeFontType(name, index) {
			// reset categories
			let categories = this.categories;
			categories = categories.map((i) => {
				if (i.name === name) {
					i.active = true;
					this.currentCategory = i;
				} else {
					i.active = false;
				}
				return i;
			});
			this.categories = categories;

			// Set fontGroup
			let fontGroup = [];
			if (index == null) {
				fontGroup = this.fonts;
			} else {
				fontGroup = this.fontGroups[index].options;
			}
			this.currentFontGroup = fontGroup;
		},

		loadFonts(_fonts, groupName, size, startIndex, search) {
			this.loadedFonts = true;
			let fonts = null;
			if (groupName === 'Uploaded') {
				fonts = this.customFontsList;
				this.loadedFonts = false;
			}

			let PromiseFonts = [];
			if (groupName === 'All Fonts') {
				fonts = _fonts;
				// If I have uploaded some fonts it should be add to the all fonts list
				this.customFontsList && this.customFontsList.map(font => fonts.indexOf(font) === -1 && fonts.unshift(font))
			} else {
				this.fontGroups && this.fontGroups.map(elem => {
					if (elem.label === groupName) fonts = elem.options
				});
			}
			if (search) {
				fonts = _fonts;
				let searchArr = [];
				this.fontsArrByLoad = [];
				for (let i = 0; i < fonts.length; i++) {
					if (DISABLED_FONTS.indexOf(this.snippetFontFamily) > -1) {
						this.disabledFont = this.snippetFontFamily
					}
					if (fonts[i].toLowerCase().includes(search.toLowerCase())) {
						searchArr.push(fonts[i])
					}
				}
				this.searchListFonts = fonts = searchArr;
			}
			if (fonts && fonts.length) {
				this.filteredListFonts = fonts;
				this.fontsArrByLoad = [];
				this.startIndex = startIndex;
				for (let i = startIndex; i < startIndex + size; i++ ) {
					if (DISABLED_FONTS.indexOf(this.snippetFontFamily) > -1) {
						this.disabledFont = this.snippetFontFamily
					}
					if (!fonts[i]) continue;
					this.fontsArrByLoad[i] = fonts[i];
					PromiseFonts.push(ClientFontLoader.loadFont(fonts[i]))
				}
			}
			this.checkDisabledFonts(this.fontsArrByLoad);
			Promise.all(PromiseFonts).then(_res => {
				this.loadedFonts = false;
			}).catch(err => console.error(err));
			return this.fontsArrByLoad.slice(startIndex, startIndex + size);
		}
	},
	destroyed() {
		this.$emit('removeValue')
	}
};
</script>
<style scoped lang="scss">
	.font-list {
		height: 370px;
		.looking-font {
			text-align: center;
			margin-top: 5px;
			margin-bottom: 0;
			> span {
				animation-name: blink;
				animation-duration: 1.4s;
				animation-iteration-count: infinite;
				animation-fill-mode: both;
				font-weight: 900;
				&:nth-child(2) {
					animation-delay: .2s;
				}
				&:nth-child(3) {
					animation-delay: .4s;
				}
			}
		}
		.picker-ul {
			position: relative;
			height: calc(100% - 20px) !important;
			> li {
				position: absolute;
				&.disabled-font {
					opacity: .5;
					pointer-events: none;
				}
			}
		}
	}
	@keyframes blink {
		0% {
			opacity: .2;
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: .2;
		}
	}
</style>
