<?php

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::domain('{university}.'.env('APP_DOMAIN'))->group(function () {
    Route::get('/', 'UniversityController@getUniversity')->name('university');
    Route::get('{program}', 'ProgramController@getProgram')->name('program');
});

// "fake" subdomain routing in local environment
if (app()->environment('local')) {
    Route::prefix('{university}')->group(function () {
        Route::get('/', 'UniversityController@getUniversity')->name('university');
        Route::get('{program}', 'ProgramController@getProgram')->name('program');
    });
}

Route::get('/', 'HomeController@getIndex')->name('index');
