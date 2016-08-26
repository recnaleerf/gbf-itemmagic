(function() {
	var summons, crateNum;
	
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if(!("action" in request) || request.action !== "crate") {
			return;
		}
		
		if(!("summons" in request) || !("crateNum" in request)) {
			return;
		}
		
		summons = request.summons;
		crateNum = request.crateNum;
		
		getUid(function(uid) {
			getFreeInventorySpace(uid, summons, crateNum);
		});
	});

	function getFreeInventorySpace(uid, summons, crateNum) {
		var url = buildUrl("/present/possessed", uid);
		
		var req = new XMLHttpRequest();
		req.open("GET", url);
		
		req.onload = function() {
			var data = JSON.parse(req.responseText);
			
			var parent;
			if(!summons) {
				parent = data.weapon_count;
			} else {
				parent = data.summon_count;
			}
			
			var free = parseInt(parent.max_count) - parseInt(parent.current_count);
			if(free === 0) {
				alert("Your " + (summons ? "summon" : "weapon") + " inventory is full.");
				return;
			}
			
			moveAngels(uid, summons, crateNum, free);
		};
		
		req.send();
	}
	
	function moveAngels(uid, summons, crateNum, free) {
		var url = buildUrl("/container/content/index", uid);
		
		var req = new XMLHttpRequest();
		req.open("GET", url);
		
		req.onload = function() {
			var data = decodeURIComponent(JSON.parse(req.responseText).data);
			var doc = new DOMParser().parseFromString(data, "text/html");
			
			var crates;
			if(!summons) {
				crates = doc.querySelectorAll(".btn-container[data-href*='weapon']");
			} else {
				crates = doc.querySelectorAll(".btn-container[data-href*='summon']");
			}
			
			if(crateNum < 1 || crateNum > crates.length) {
				alert("Invalid crate number.");
				return;
			}
			
			getVersion(function(version) {
				getList(uid, summons, crates[crateNum - 1].getAttribute("c_id"), free, 1, [], version);
			});
		};
		
		req.send();
	}

	function getList(uid, summons, crateId, free, index, list, version) {
		var url = buildUrl("/" + (summons ? "summon" : "weapon") + "/list_container/" + index + (!summons ? "/-1" : "") + "/5/" + crateId, uid);
		
		var req = new XMLHttpRequest();
		req.open("POST", url);
		req.setRequestHeader("Content-Type", "application/json");
		req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		req.setRequestHeader("X-VERSION", version);
		
		req.onload = function() {
			var response = JSON.parse(req.responseText);
			
			for(var i = 0; i < response.list.length; i++) {
				var entry = response.list[i];
				if((summons && angelSummonIds.indexOf(entry.master.id) >= 0) || (!summons && angelWeaponIds.indexOf(entry.master.id) >= 0)) {
					list.push(entry);
				}
				
				if(list.length === free) {
					break;
				}
			}
			
			if(response.next <= index || list.length === free) {
				// Done
				if(list.length === 0) {
					alert("No angels were found in the selected crate.");
					return;
				}
				
				if(window.confirm(list.length + " angel " + (summons ? "summon" : "weapon") + (list.length > 1 ? "s" : "") + " will be moved.")) {
					var ids = list.map(function(val) {
						return val.param.id;
					});
					
					doMove(uid, summons, crateId, ids);
				}
			} else {
				// There are more pages, keep going
				getList(uid, summons, crateId, free, index + 1, list, version);
			}
		};
		
		req.onerror = function() {
			alert("An error occurred while trying to get the contents of the crate.");
		};
		
		req.send(JSON.stringify({special_token: null, is_new: false}));
	}

	function doMove(uid, summons, crateId, ids) {
		var url = buildUrl("/container/move", uid);
		
		var req = new XMLHttpRequest();
		req.open("POST", url);
		req.setRequestHeader("Content-Type", "application/json");
		
		req.onload = function() {
			var response = JSON.parse(req.responseText);
			
			alert("Result:\n" + response.from_name + " " + response.from_number + "/" + response.from_max_number + "\n" + response.to_name + " " + response.to_number + "/" + response.to_max_number);
		};
		
		req.onerror = function() {
			alert("An error occurred while trying to execute selling.");
		};
		
		req.send(JSON.stringify({
			special_token: null,
			item_list: ids,
			duplicate_key: "undefined_" + ids.join("_"),
			container_id: crateId,
			to: "to_list"
		}));
	}
})();
