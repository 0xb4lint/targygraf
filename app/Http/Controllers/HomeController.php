<?php

namespace App\Http\Controllers;

use App\University;

class HomeController extends Controller
{
    public function getIndex()
    {
        $universities = University::orderBy('row')
            ->orderBy('ordering')
            ->get();

        return view('layouts.index', [
            'universities' => $universities,
        ]);
    }
}
