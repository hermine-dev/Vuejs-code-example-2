import axios from 'axios';
// initial state
const state = {
	enhanceData: [],
	filtersData: [],
	imageId: null,
	mainSnippets: [],
	lastAddSnippets: null,
	activeSnippetData: {},
	selectedSnippetID: null,
	fontFilter: {},
	recentlyUsedColors: [],
	currentlyUsedColors: [],
	recentlyUsedColorsOutline: [],
	currentlyUsedColorsOutline: [],
	customFontsList: [],
	savedTemplates: [],
	isAdmin: '',
	picSnippetName: null,
	editorLoading: true,
};
//getters
const getters = {
	isTemplateSaved: (state, _getters) => (id) => {
		return state.savedTemplates.find(template => template.id === id);
	},
};

let debounceDispatch;
//actions
const actions = {
	getActives (_action, payload) {
		return axios.get(`/getActive?${payload}`);
	},
	getArchived (_action, payload) {
		return axios.get(`/getArchived?${payload}`);
	},

	getHomeTemplates (_action, payload) {
		return axios.get(`/getHomeTemplates?${payload}`);
	},

	addParameter (_action, payload) {
		return axios.post(`/api/text-snippet/${payload.id}/parameter`, payload.param.toObject());
	},
	removeParameter (_action, payload) {
		return axios.delete(`/api/text-snippet/${payload.snippetUuid}/parameter/${payload.parameterId}`);
	},
	removeParameters (_action, payload) {
		return axios.delete('/api/text-snippet/delete-parameters', {parameterIds: payload.parameterIds, textSnippetId: payload.snippetUuid});
	},
	changeEnhance ({commit}, payload) {
		commit('CHANGE_ENHANCE_DATA', payload);

		const enhance = state.enhanceData.reduce((acc, enhance) => {
			acc[enhance.text] = enhance.value;
			return acc;
		}, {});
		if (debounceDispatch) clearTimeout(debounceDispatch);

		debounceDispatch = setTimeout(() => { //debouncing input range requests
			axios.put(`/api/pic-snippet/${payload.id}/effects`, {enhance: enhance});
		}, 1000);
	},
	changeFilters ({commit, state}, payload) {
		commit('CHANGE_FILTERS_DATA', payload);

		const filters = state.filtersData.reduce((acc, filter) => {
			acc[filter.text] = filter.value;
			return acc;
		}, {});

		return axios.put(`/api/pic-snippet/${payload.id}/effects`, {filters: filters});
	},
	changePicSnippetName ({_state}, payload) {
		return axios.put('/api/pic-snippet/' + payload.id, {title: payload.text});
	},
};

//mutations
const mutations = {
	ADD_SNIPPET (state, payload) {
		if (payload instanceof Array) {
			state.mainSnippets = payload;
		} else {
			state.mainSnippets.push(payload);
		}
	},

	CHANGE_FALLBACK_PARAMS (state, payload) {
		state.fallBackData = {...state.fallBackData};
		const _fallBack = state.fallBackData[payload.id].find(fallback => fallback.id === payload.idParam);
		if (_fallBack) {
			_fallBack[payload.param] = payload.value;
		}
	},
	REMOVE_SNIPPET (state, payload) {
		state.selectedSnippetID = '';
		const removeItemIndex = state.mainSnippets.findIndex(elem => elem.id === payload);
		if (removeItemIndex > -1){
			state.mainSnippets.splice(removeItemIndex, 1);
			// For Removing currently used color
			const colorIndex = state.currentlyUsedColors.findIndex(color => color.id === payload);
			const colorOutlineIndex = state.currentlyUsedColorsOutline.findIndex(color => color.id === payload);
			if (colorOutlineIndex > -1) {
				state.currentlyUsedColorsOutline.splice(colorOutlineIndex, 1);
			}
			if (colorIndex > -1) {
				state.currentlyUsedColors.splice(colorIndex, 1);
			}
		}
	},

	CHANGE_PARAMS_OF_ACTIVE_SNIPPET (state, payload) {
		const currentSnippet = state.mainSnippets.find(elem => elem.id === payload.id);
		if (payload.params.name instanceof Array) {
			payload.params.name.map(name => {
				currentSnippet[name] = payload.params[name];
			});
		} else {
			currentSnippet[payload.params.name] = payload.params[payload.params.name];
		}
	},
	SET_LAST_ADD_SNIPPET (state, payload) {
		const _current = state.mainSnippets.filter(snippet => snippet.id === payload);
		state.lastAddSnippets = _current[0];
	},

	SET_ACTIVE_SNIPPET_DATA (state, payload) {
		state.activeSnippetData = {...state.activeSnippetData};
		if (payload.length && payload.constructor.name === 'Array') {
			payload.forEach(obj => {
				Object.keys(obj).map(props => {
					state.activeSnippetData[props] = obj[props];
				});
			});
		} else {
			Object.keys(payload).map(props => {
				state.activeSnippetData[props] = payload[props];
			});
		}
	},
	SET_CURRENT_SNIPPET_ID (state, payload) {
		state.selectedSnippetID = payload;
	},
	SET_FILTER_TAB_OF_FONT (state, payload) {
		state.fontFilter.pos = payload.pos;
		state.fontFilter.name = payload.name;
	},
	SET_CUSTOM_FONTS_LIST (state, payload) {
		state.customFontsList = payload.sort((a, b) => {
			if ( a < b ) return -1;
			if ( a > b ) return 1;
			return 0;
		}).reverse();
	},
	SET_RECENTLY_USED_COLORS (state, payload) {
		let currentState = (payload.type === 'color') ? state.recentlyUsedColors: state.recentlyUsedColorsOutline;
		if (payload.value.fill instanceof Array) {
			currentState = [...payload.value.fill];
		} else {
			currentState.push(payload.value.fill);
		}
		if (currentState.length > 5) {
			let recentlyUsed = JSON.parse(JSON.stringify(currentState));
			recentlyUsed = recentlyUsed.slice(-5, currentState.length);
			currentState = recentlyUsed;
		}
		let getStorageValue = JSON.parse(localStorage.getItem(payload.value.userID)) || {};
		getStorageValue[[payload.type]] = currentState;
		localStorage.setItem(payload.value.userID, JSON.stringify(getStorageValue));
		(payload.type === 'color') ? state.recentlyUsedColors = currentState: state.recentlyUsedColorsOutline = currentState;
	},
	SET_CURRENTLY_USED_COLORS (state, payload) {
		if (payload.value instanceof Array) {
			let stateObject = [];
			if (payload.length > 5) {
				stateObject = payload.value.slice(-5, payload.value.length);
			} else {
				stateObject = payload.value;
			}
			(payload.type === 'color') ? state.currentlyUsedColors = stateObject : state.currentlyUsedColorsOutline = stateObject;
		} else {
			const currentFill =  ((payload.type === 'color') ? state.currentlyUsedColors : state.currentlyUsedColorsOutline).find(color => color.id === payload.value.id);
			if (currentFill) {
				currentFill.fill = payload.value.fill;
			} else {
				if (state[(payload.type === 'color') ? 'currentlyUsedColors' : 'currentlyUsedColorsOutline'].length === 5) {
					state[(payload.type === 'color') ? 'currentlyUsedColors' : 'currentlyUsedColorsOutline'].shift();
				}
				state[(payload.type === 'color') ? 'currentlyUsedColors' : 'currentlyUsedColorsOutline'].push(payload.value);
			}
		}
	},
	SET_IMAGE_ID (state, payload) {
		state.imageId = payload;
	},
	SAVE_ENHANCE (state, payload) {
		state.enhanceData = payload;
	},
	SAVE_FILTERS (state, payload) {
		state.filtersData = payload;
	},
	CHANGE_ENHANCE_DATA (state, payload) {
		state.enhanceData = JSON.parse(JSON.stringify(state.enhanceData));
		const currentRange = state.enhanceData.find(range => range.text === payload.type);
		if (currentRange) {
			currentRange.value = payload.value;
		}
	},
	CHANGE_FILTERS_DATA (state, payload) {
		state.filtersData = JSON.parse(JSON.stringify(state.filtersData));
		const currentFilter = state.filtersData.find(range => range.text === payload.type);
		if (currentFilter) {
			currentFilter.value = payload.value;
		}
	},
	SET_SAVED_TEMPLATES (state, payload) {
		state.savedTemplates = [...state.savedTemplates];
		state.savedTemplates.push({
			id: payload.id,
			status: payload.status,
			tags: payload.tags,
		});
	},
	UPDATE_SAVED_TEMPLATES (state, payload) {
		state.savedTemplates = [...state.savedTemplates];
		const currentTemplate = state.savedTemplates.find(template => template.id = payload.id);
		if (currentTemplate) {
			payload.changedOptions.split(',').forEach(option => {
				currentTemplate[option] = payload[option];
			});
		}
	},
	SET_IS_ADMIN (state, payload) {
		state.isAdmin = payload;
	},
	SET_PIC_SNIPPET_NAME (state, payload) {
		state.picSnippetName = payload;
	},
	SET_LOADING (state, payload) {
		state.editorLoading = payload;
	},
};
export default {
	namespaced: true,
	state,
	getters,
	mutations,
	actions,
};
