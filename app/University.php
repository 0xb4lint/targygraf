<?php

namespace App;

use Illuminate\Database\Eloquent\SoftDeletes;

class University extends Model
{
    use SoftDeletes;

    protected $table = 'universities';



    public function faculties()
    {
        return $this->hasMany(Faculty::class);
    }
}
