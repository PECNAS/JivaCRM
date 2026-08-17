from django.http import HttpResponse
from django.views import View
from django.shortcuts import render, redirect

class IndexView(View):
	def get(self, request):
		return render(request, "index.html")

	def post(self, request):
		return HttpResponse("POST request successfully!")

class ClientsView(View):
	def get(self, request):
		return render(request, "clients.html")

	def post(self, request):
		return HttpResponse("POST request successfully!")

class OrdersView(View):
	def get(self, request):
		return render(request, "orders.html")

	def post(self, request):
		return HttpResponse("POST request successfully!")

class ScheduleView(View):
	def get(self, request):
		return render(request, "schedule.html")

	def post(self, request):
		return HttpResponse("POST request successfully!")

