angular.module('AppModule').controller('AppController', ['$scope', '$http', function($scope, $http){

	$scope.reconnecting=false;
	 
	$scope.stats={};
	
	
	$scope.status="Disconnected"
			
	// Connect to dashboard socket
	io.socket.post('/dashboard', {}, function (stats) {
		$scope.status="Connected";
		$scope.stats=stats;
		$scope.populate();
		$scope.$apply();
	});

	// React to data received
	io.socket.on("dashboard", function (stats) { 
		$scope.status="Connected";
		$scope.stats=stats;
		$scope.populate();
		$scope.$apply();
	});
	
	// On a connect, get the data again (assuming we disconnected)
	io.socket.on("reconnecting", function (stats) {
		$scope.stats={};
		$scope.populate();
		$scope.status="Reconnecting..."
		$scope.reconnecting=true;
		$scope.$apply(); 
	});
	
	// On a connect, get the data again (assuming we disconnected)
	io.socket.on("connect", function (stats) {
		$scope.status="Connected";
		if ($scope.reconnecting) {		 
			io.socket.get('/dashboard', {}, function (stats) {
				$scope.reconnecting=false;
				$scope.stats=stats;	
				$scope.populate();
				$scope.$apply(); 
			}); 		
		}
		else {
			$scope.$apply();
		}
	});
	
	
	io.socket.on("disconnect", function (stats) {
		$scope.stats={};
		$scope.populate();
		$scope.status="Disconnected";
		$scope.$apply();
	});

	$scope.populate=function(){
		$scope.feeds();
		$scope.log();
	}

	$scope.feeds=function(){
		$scope.feedDta="";
		if ($scope.stats.feeds) {
			//$scope.feedDta+=("dashboard\n")
			$scope.stats.feeds.forEach(function(feed,i){
				$scope.feedDta+=(feed+"\n")
			})			
		}		
	}

	$scope.log=function(){
		$scope.logDta="";
		if ($scope.stats.log) {			
			$scope.stats.log.forEach(function(log,l){
				$scope.logDta+=(JSON.stringify(log)+"\n")
			})			
		}		
	}
	
}])