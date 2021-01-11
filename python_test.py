# code 
import sys 
import requests 
from bs4 import BeautifulSoup  
from csv import writer
from requests import get

def print_to_stderr(*a): 
  
    # Here a is the array holding the objects 
    # passed as the arguement of the function 
    print(*a, file = sys.stderr) 
  
print_to_stderr("Hello World") 